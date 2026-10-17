#!/usr/bin/env bash
set -euo pipefail
DOMAIN="fangbaleida.com"
echo "Checking public DNS and HTTPS on $DOMAIN"
for i in 1 2 3 4 5 6; do
  if curl --fail --silent --show-error --connect-timeout 8 --max-time 18 --output /tmp/fangbaleida-home.html "https://$DOMAIN/"; then break; fi
  echo "Domain not externally ready yet, attempt $i/6"; sleep 5
done
test -s /tmp/fangbaleida-home.html
grep -Fq 'https://fangbaleida.com/' /tmp/fangbaleida-home.html
echo 'Homepage HTTPS and canonical URL: OK'
curl --fail --silent --show-error --connect-timeout 8 --max-time 18 "https://$DOMAIN/api/health" -o /tmp/fangbaleida-health.json
python3 - <<'PY'
import json
with open('/tmp/fangbaleida-health.json', encoding='utf-8') as f: data=json.load(f)
assert isinstance(data,dict), 'health endpoint did not return a JSON object'
print('Health endpoint returned JSON; keys:', ', '.join(list(data)[:10]))
PY
status=$(curl -sS --connect-timeout 8 --max-time 18 --output /dev/null --write-out '%{http_code}|%{redirect_url}' "https://www.$DOMAIN/")
echo "www response: $status"
[[ "$status" == 308* || "$status" == 301* || "$status" == 302* ]]
[[ "$status" == *"fangbaleida.com"* ]]
old=$(curl -sS --connect-timeout 8 --max-time 18 --output /dev/null --write-out '%{http_code}|%{redirect_url}' "https://find-thief.vercel.app/privacy.html")
echo "old-domain redirect response: $old"
[[ "$old" == 308* ]]
[[ "$old" == *"https://fangbaleida.com/privacy.html"* ]]
echo 'Live new-domain SSL, homepage, API, www and old-domain redirect verified.'
