#!/bin/bash
# Remove broken/wrong datasources (e.g. PostgreSQL-1 with localhost/SSL) so only
# the provisioned PostgreSQL (uid=postgres) is used. Run after Grafana is up.
set -euo pipefail
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"
GRAFANA_USER="${GRAFANA_USER:-admin}"
GRAFANA_PASS="${GRAFANA_PASS:-zenbook}"

echo "Listing datasources..."
DS_JSON=$(curl -s -u "$GRAFANA_USER:$GRAFANA_PASS" "$GRAFANA_URL/api/datasources" 2>/dev/null) || {
  echo "Could not reach Grafana at $GRAFANA_URL (is it running?)"
  exit 1
}

# Delete every datasource that does NOT have uid "postgres" (keep only our provisioned one)
echo "$DS_JSON" | python3 -c "
import json, sys, os, urllib.request
try:
    ds_list = json.load(sys.stdin)
except Exception as e:
    print('Failed to parse datasources:', e)
    sys.exit(1)
url = os.environ.get('GRAFANA_URL', 'http://localhost:3000')
user = os.environ.get('GRAFANA_USER', 'admin')
passwd = os.environ.get('GRAFANA_PASS', 'zenbook')
auth = (user + ':' + passwd).encode()
for d in ds_list:
    uid = d.get('uid', '')
    name = d.get('name', '')
    did = d.get('id')
    if uid != 'postgres':
        del_url = f'{url}/api/datasources/uid/{uid}'
        req = urllib.request.Request(del_url, method='DELETE')
        req.add_header('Authorization', 'Basic ' + __import__('base64').b64encode(auth).decode())
        try:
            urllib.request.urlopen(req)
            print(f'Deleted datasource: {name} (uid={uid})')
        except Exception as e:
            print(f'Failed to delete {name}: {e}')
    else:
        print(f'Keeping datasource: {name} (uid=postgres)')
" 2>/dev/null || {
  echo "Falling back: deleting by uid via curl..."
  for uid in $(echo "$DS_JSON" | grep -o '"uid":"[^"]*"' | cut -d'"' -f4); do
    if [ "$uid" != "postgres" ]; then
      curl -s -u "$GRAFANA_USER:$GRAFANA_PASS" -X DELETE "$GRAFANA_URL/api/datasources/uid/$uid" && echo "Deleted uid=$uid"
    fi
  done
}

echo "Done. If the correct PostgreSQL (uid=postgres) was missing, restart Grafana to load from postgres.yaml:"
echo "  docker compose -f grafana/docker-compose.yml restart grafana"
echo "Then open: Connections → Data sources. You should see only 'PostgreSQL'."
