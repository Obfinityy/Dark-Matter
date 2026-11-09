#!/usr/bin/env bash
# oauth-lab smoke test — run against a live server instance.
# Usage: ./smoke-test.sh [base-url]   (default http://127.0.0.1:3620)
# Start the server first:  node server.js
# Exits 0 only if every check passes. No Docker needed.
set -u
BASE="${1:-http://127.0.0.1:3620}"
PASS=0
FAIL=0

# jget <json> <key> — print a top-level JSON value (python3 stdlib).
# Booleans print as JSON lowercase true/false.
jget() { python3 -c 'import json,sys; d=json.load(sys.stdin); v=d.get(sys.argv[1],""); print("true" if v is True else "false" if v is False else "" if v is None else v)' "$2" <<<"$1"; }
# jgetn <json> <key> — print a nested dict value as JSON.
jgetn() { python3 -c 'import json,sys; d=json.load(sys.stdin); print(json.dumps(d.get(sys.argv[1],{})))' "$2" <<<"$1"; }

check() { # check <name> <expected> <actual>
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "PASS: $1";
  else FAIL=$((FAIL+1)); echo "FAIL: $1 (expected '$2', got '$3')"; fi
}
check_contains() { # check_contains <name> <needle> <haystack>
  case "$3" in *"$2"*) PASS=$((PASS+1)); echo "PASS: $1";; *)
    FAIL=$((FAIL+1)); echo "FAIL: $1 (missing '$2' in: $3)";; esac
}

echo "== oauth-lab smoke test against $BASE =="

# 0. health
H=$(curl -s "$BASE/health")
check "health ok" "true" "$(jget "$H" ok)"
check "health service" "oauth-lab" "$(jget "$H" service)"

# 1. #487 magic link: redeem twice (no expiry, no single-use)
ML=$(curl -s -X POST "$BASE/api/auth/magic-link" -H 'content-type: application/json' -d '{"email":"lab-user@example.com"}')
TOK=$(jget "$ML" token)
check "magic-link token issued" "ml-" "${TOK:0:3}"
R1=$(curl -s "$BASE/api/auth/magic-link/redeem?token=$TOK")
check "magic-link redeem #1" "200" "$(echo "$R1" | python3 -c 'import json,sys; print(200 if json.load(sys.stdin).get("sessionToken") else 0)')"
check "magic-link redeem #1 count" "1" "$(jget "$R1" redeemedCount)"
R2=$(curl -s "$BASE/api/auth/magic-link/redeem?token=$TOK")
check "magic-link redeem #2 (replay)" "2" "$(jget "$R2" redeemedCount)"

# 1b. #487 state redeemable as magic link
AZ=$(curl -s "$BASE/oauth/authorize?response_type=code&client_id=lab-client&redirect_uri=$BASE/oauth/callback&idp=idp-acme&email=lab-user@example.com")
STATE=$(jget "$AZ" state)
RS=$(curl -s "$BASE/api/auth/magic-link/redeem?token=$STATE")
check "oauth state redeems as magic link" "oauth-state" "$(jget "$RS" tokenKind)"

# 2. #488 pre-account hijacking: register victim, magic-link sign-in, attacker password still works
curl -s -X POST "$BASE/api/auth/register" -H 'content-type: application/json' -d '{"email":"victim@example.com","password":"attacker-pass"}' >/dev/null
MLV=$(curl -s -X POST "$BASE/api/auth/magic-link" -H 'content-type: application/json' -d '{"email":"victim@example.com"}')
TOKV=$(jget "$MLV" token)
curl -s "$BASE/api/auth/magic-link/redeem?token=$TOKV" >/dev/null
LG=$(curl -s -X POST "$BASE/api/auth/login" -H 'content-type: application/json' -d '{"email":"victim@example.com","password":"attacker-pass"}')
check "pre-account hijack: attacker password still works" "200" "$(echo "$LG" | python3 -c 'import json,sys; print(200 if json.load(sys.stdin).get("sessionToken") else 0)')"

# 3. #489 unverified-email IdP: idp-quick registers victim2, its code logs in
curl -s -X POST "$BASE/idp/idp-quick/register" -H 'content-type: application/json' -d '{"email":"victim2@example.com","password":"attacker-pass"}' >/dev/null
AZ2=$(curl -s "$BASE/oauth/authorize?response_type=code&client_id=lab-client&redirect_uri=$BASE/oauth/callback&idp=idp-quick&email=victim2@example.com")
C2=$(jget "$AZ2" code)
CB2=$(curl -s "$BASE/oauth/callback?code=$C2")
check "idp-quick code logs in unverified email" "victim2@example.com" "$(jget "$CB2" email)"

# 4. #490 forced linking: attacker code linked into victim (lab-user) session
VSESS=$(curl -s -X POST "$BASE/api/auth/login" -H 'content-type: application/json' -d '{"email":"lab-user@example.com","password":"lab-pass"}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["sessionToken"])')
curl -s -X POST "$BASE/idp/idp-quick/register" -H 'content-type: application/json' -d '{"email":"attacker@example.com","password":"attacker-pass"}' >/dev/null
AZ3=$(curl -s "$BASE/oauth/authorize?response_type=code&client_id=lab-client&redirect_uri=$BASE/oauth/callback&idp=idp-quick&email=attacker@example.com")
C3=$(jget "$AZ3" code)
LK=$(curl -s -X POST "$BASE/oauth/link" -H 'content-type: application/json' -H "Authorization: Bearer $VSESS" -d "{\"code\":\"$C3\"}")
check "forced link accepted" "attacker@example.com" "$(python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("linked",{}).get("email",""))' <<<"$LK")"

# 5. #491 code injection: victim session + attacker code + bogus state → session becomes attacker
VSESS2=$(curl -s -X POST "$BASE/api/auth/login" -H 'content-type: application/json' -d '{"email":"lab-user@example.com","password":"lab-pass"}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["sessionToken"])')
AZ4=$(curl -s "$BASE/oauth/authorize?response_type=code&client_id=lab-client&redirect_uri=$BASE/oauth/callback&idp=idp-quick&email=attacker@example.com")
C4=$(jget "$AZ4" code)
CB4=$(curl -s "$BASE/oauth/callback?code=$C4&state=bogus-state&session=$VSESS2")
check "callback accepts bogus state" "false" "$(jget "$CB4" stateValidated)"
ME=$(curl -s "$BASE/api/auth/me?session=$VSESS2")
check "injected session now resolves to attacker" "attacker@example.com" "$(jget "$ME" email)"

# 6. #492 IdP mix-up: idp-quick code redeems at token endpoint, issuer never validated
AZ5=$(curl -s "$BASE/oauth/authorize?response_type=code&client_id=lab-client&redirect_uri=$BASE/oauth/callback&idp=idp-quick&email=attacker@example.com")
C5=$(jget "$AZ5" code)
TK=$(curl -s -X POST "$BASE/oauth/token" -H 'content-type: application/json' -d "{\"grant_type\":\"authorization_code\",\"code\":\"$C5\",\"client_id\":\"lab-client\"}")
check "mix-up: idp-quick code redeems" "idp-quick" "$(jget "$TK" issued_by_idp)"
check "mix-up: issuer not validated" "false" "$(jget "$TK" issuer_validated)"
RT=$(jget "$TK" refresh_token)

# 7. #493 dynamic registration SSRF: server fetches jwks_uri; metadata IP refused
RG=$(curl -s -X POST "$BASE/oauth/register" -H 'content-type: application/json' -d '{"client_name":"lab","redirect_uris":["http://localhost/cb"],"jwks_uri":"http://127.0.0.1:3620/health","logo_uri":"http://169.254.169.254/latest/meta-data/"}')
check "dynamic registration returns client" "cid-" "$(jget "$RG" client_id | cut -c1-4)"
FL=$(curl -s "$BASE/api/admin/fetch-log")
check_contains "SSRF fetch of jwks_uri logged" "127.0.0.1:3620/health" "$FL"
check_contains "metadata IP blocked" "blocked-metadata-ip" "$FL"

# 8. #497 refresh-token reuse: same token works twice, never rotates
RF1=$(curl -s -X POST "$BASE/oauth/token" -H 'content-type: application/json' -d "{\"grant_type\":\"refresh_token\",\"refresh_token\":\"$RT\"}")
check "refresh reuse #1" "1" "$(jget "$RF1" refreshReuseCount)"
check "refresh not rotated" "false" "$(jget "$RF1" rotated)"
RF2=$(curl -s -X POST "$BASE/oauth/token" -H 'content-type: application/json' -d "{\"grant_type\":\"refresh_token\",\"refresh_token\":\"$RT\"}")
check "refresh reuse #2" "2" "$(jget "$RF2" refreshReuseCount)"

# 9. #502 WebAuthn: bogus challenge + evil origin accepted
curl -s -X POST "$BASE/webauthn/register/begin" -H 'content-type: application/json' -d '{"email":"lab-user@example.com"}' >/dev/null
WR=$(curl -s -X POST "$BASE/webauthn/register/finish" -H 'content-type: application/json' -d '{"email":"lab-user@example.com","credentialId":"cred-lab-1","publicKey":"lab-fake-key","challenge":"never-issued-challenge"}')
check "webauthn register accepts bogus challenge" "false" "$(jget "$WR" challengeChecked)"
WA=$(curl -s -X POST "$BASE/webauthn/authenticate/finish" -H 'content-type: application/json' -d '{"email":"lab-user@example.com","credentialId":"cred-lab-1","challenge":"stale-challenge","origin":"https://evil.example.com","signature":"lab-fake-sig"}')
check "webauthn auth accepts evil origin" "https://evil.example.com" "$(jget "$WA" originAccepted)"
check "webauthn auth returns session" "sess-" "$(jget "$WA" sessionToken | cut -c1-5)"

echo "== $PASS passed, $FAIL failed =="
[ "$FAIL" -eq 0 ]
