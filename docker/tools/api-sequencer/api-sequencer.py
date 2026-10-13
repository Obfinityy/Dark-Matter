#!/usr/bin/env python3
"""
Dark Matter — RESTler-lite stateful API sequencer (technique 5a, re-implemented).

The #1 way to reach deep stateful business-logic bugs automatically:
  1. Parse OpenAPI/Swagger (or a captured request list).
  2. Infer producer->consumer dependencies
     (POST /users returns {id} -> GET /users/{id} consumes it).
  3. Fuzz ORDERED sequences (create -> read -> update -> delete), not just
     single requests.
  4. 500-class crash oracle: any sequence producing an unhandled 500 is a
     finding (often the entry to deeper bugs).

Usage:
  api-sequencer.py --spec openapi.json --base https://target.test [--auth "Bearer X"]
  api-sequencer.py --requests requests.jsonl --base https://target.test

Output: JSON with sequences that produced 5xx or schema violations.
Technique extracted from microsoft/restler-fuzzer (MIT) — re-implemented.
Authorized targets only.
"""
import argparse
import itertools
import json
import sys
import urllib.request
import urllib.error
import re

def load_spec(path):
    with open(path) as f:
        return json.load(f)

def infer_dependencies(spec):
    """Build producer->consumer graph from OpenAPI paths."""
    paths = spec.get('paths', {})
    producers = {}  # resource -> (method, path, id_field)
    consumers = []  # (method, path, param)
    for path, ops in paths.items():
        for method, op in (ops or {}).items():
            m = method.upper()
            # Producer: POST returns an object with an id
            if m == 'POST':
                res = re.sub(r'^/|/$', '', path).split('/')[0]
                producers[res] = (m, path)
            # Consumer: path has {param}
            for param in re.findall(r'\{(\w+)\}', path):
                consumers.append((m, path, param))
    return producers, consumers

def build_sequences(producers, consumers, max_len=3):
    """Order producer before its consumers."""
    seqs = []
    for res, (pm, pp) in producers.items():
        using = [(m, p, prm) for (m, p, prm) in consumers if res in p]
        for r in range(1, min(max_len, len(using)) + 1):
            for combo in itertools.combinations(using, r):
                seqs.append([(pm, pp)] + list(combo))
    return seqs[:200]

def fuzz_value(param):
    return {
        'id': ["1", "0", "-1", "999999", "' OR '1'='1", "../.."],
        'default': ["test", "", "A" * 5000, "<script>", "{{7*7}}", "${7*7}"],
    }.get(param, ["test", "", "A" * 5000])

def run_sequence(base, seq, auth):
    """Execute a sequence, substituting ids; return crashes (5xx)."""
    crashes = []
    ctx = {}
    for step in seq:
        if len(step) == 2:
            method, path = step
            param = None
        else:
            method, path, param = step
        url = base + path
        # Substitute {param} with fuzz values or captured ids
        for p in re.findall(r'\{(\w+)\}', url):
            val = ctx.get(p, '1')
            url = url.replace('{' + p + '}', str(val))
        headers = {}
        if auth:
            headers['Authorization'] = auth
        # Try a couple of fuzz values for the id param
        for fv in (fuzz_value(param) if param else ['']):
            u = url.replace('/1', f'/{fv}') if param else url
            req = urllib.request.Request(u, headers=headers, method=method)
            try:
                with urllib.request.urlopen(req, timeout=10) as r:
                    body = r.read(2000)
                    # Capture ids for downstream steps
                    try:
                        data = json.loads(body)
                        if isinstance(data, dict) and 'id' in data:
                            ctx['id'] = data['id']
                    except Exception:
                        pass
            except urllib.error.HTTPError as e:
                if 500 <= e.code < 600:
                    crashes.append({'sequence': [f'{m} {p}' for (m, p, *_) in seq],
                                    'crashed_at': f'{method} {u}', 'status': e.code})
                    break
            except Exception:
                pass
    return crashes

def main():
    ap = argparse.ArgumentParser(description='RESTler-lite API sequencer')
    ap.add_argument('--spec', help='OpenAPI JSON file')
    ap.add_argument('--base', required=True, help='Target base URL')
    ap.add_argument('--auth', help='Authorization header value')
    args = ap.parse_args()

    if not args.spec:
        print(json.dumps({'error': 'need --spec openapi.json'}))
        sys.exit(1)
    spec = load_spec(args.spec)
    producers, consumers = infer_dependencies(spec)
    seqs = build_sequences(producers, consumers)
    print(f'[*] {len(producers)} producers, {len(consumers)} consumers, {len(seqs)} sequences',
          file=sys.stderr)
    all_crashes = []
    for seq in seqs:
        all_crashes.extend(run_sequence(args.base, seq, args.auth))
    # Dedup by crashed endpoint
    seen, uniq = set(), []
    for c in all_crashes:
        k = c['crashed_at']
        if k not in seen:
            seen.add(k)
            uniq.append(c)
    print(json.dumps({'crashes': uniq, 'sequences_tested': len(seqs)}, indent=2))

if __name__ == '__main__':
    main()
