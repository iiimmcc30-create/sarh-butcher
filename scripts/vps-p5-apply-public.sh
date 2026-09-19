#!/usr/bin/env bash
# Run ON the VPS as root from /opt/sarh-butcher after nginx/env files are copied.
# Publishes malahem.sarhsa.online over the existing Sarh edge (SNI) without
# attaching Malahem containers to sarh_internal.
set -euo pipefail
cd /opt/sarh-butcher

DOMAIN=malahem.sarhsa.online
ORIGIN="https://${DOMAIN}"

python3 - <<'PY'
import os, re
from pathlib import Path

mal_path = Path("/opt/sarh-butcher/.env")
sarh_path = Path("/opt/sarh/.env.production")

def parse(path: Path) -> dict[str, str]:
    data: dict[str, str] = {}
    if not path.exists():
        return data
    for raw in path.read_text().splitlines():
        if not raw.strip() or raw.lstrip().startswith("#") or "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        data[key] = value
    return data

def write(path: Path, data: dict[str, str], order: list[str]) -> None:
    lines = []
    seen = set()
    for key in order:
        if key in data:
            lines.append(f"{key}={data[key]}")
            seen.add(key)
    for key in sorted(data):
        if key not in seen:
            lines.append(f"{key}={data[key]}")
    path.write_text("\n".join(lines) + "\n")
    os.chmod(path, 0o600)

def unquote(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value

mal = parse(mal_path)
sarh = parse(sarh_path)
order = list(mal.keys())
origin = "https://malahem.sarhsa.online"

# Shared provider keys already copied; fill remaining aliases from Sarh.
if not unquote(mal.get("NI_BASE_URL", "")).strip():
    incoming = unquote(sarh.get("NI_BASE_URL", "")).strip() or unquote(sarh.get("NI_API_BASE", "")).strip()
    if incoming:
        mal["NI_BASE_URL"] = incoming
        mal["NI_API_BASE"] = incoming
        mal["MALAHEM_NI_BASE_URL"] = incoming
for key in ("NI_BASIC_AUTH", "NI_REALM"):
    incoming = sarh.get(key, "").strip()
    if incoming and not unquote(mal.get(key, "")).strip():
        mal[key] = sarh[key]
if not unquote(mal.get("NI_API_BASE", "")).strip() and unquote(mal.get("NI_BASE_URL", "")).strip():
    mal["NI_API_BASE"] = unquote(mal["NI_BASE_URL"])

mal["NODE_ENV"] = "production"
mal["DEV_OTP"] = "false"
mal["SKIP_MIGRATIONS"] = "true"
mal["JWT_ISSUER"] = "malahm-sarh"
mal["REDIS_KEY_PREFIX"] = "butcherapp:"
mal["CLOUDINARY_FOLDER"] = "sarh-butcher"
mal["APP_DEEP_LINK_SCHEME"] = "malahm"
mal["APP_ANDROID_PACKAGE"] = "com.sarh.butcher"
mal["APP_URL"] = origin
mal["PUBLIC_API_URL"] = origin
mal["PUBLIC_SOCKET_URL"] = origin
mal["MALAHEM_APP_URL"] = origin
mal["MALAHEM_API_URL"] = origin
mal["MALAHEM_DASHBOARD_URL"] = origin
mal["MALAHEM_ADMIN_URL"] = origin
mal["NEXT_PUBLIC_API_URL"] = origin
mal["NEXT_PUBLIC_SOCKET_URL"] = origin
mal["ALLOWED_ORIGINS"] = origin
mal["DAFTRA_OAUTH_REDIRECT_URI"] = f"{origin}/api/butchers/daftra/oauth/callback"
mal["NI_MERCHANT_ORDER_PREFIX"] = "MALAHM"
mal["STORAGE_PROVIDER"] = "cloudinary"

secrets_dir = Path("/opt/sarh-butcher/secrets")
secrets_dir.mkdir(mode=0o700, exist_ok=True)
key_file = secrets_dir / "firebase-private-key.pem"
sarh_key = unquote(sarh.get("FIREBASE_PRIVATE_KEY", "")).replace("\\n", "\n").strip()
if sarh_key and "BEGIN" in sarh_key:
    key_file.write_text(sarh_key + ("\n" if not sarh_key.endswith("\n") else ""))
    key_file.chmod(0o600)
    mal["FIREBASE_PRIVATE_KEY_FILE"] = str(key_file)
    mal.pop("FIREBASE_PRIVATE_KEY", None)
    print("FIREBASE_KEY_FILE=written")
elif key_file.exists() and key_file.stat().st_size > 0:
    mal["FIREBASE_PRIVATE_KEY_FILE"] = str(key_file)
    mal.pop("FIREBASE_PRIVATE_KEY", None)
    print("FIREBASE_KEY_FILE=existing")
else:
    print("FIREBASE_KEY_FILE=missing")

write(mal_path, mal, order)
print("NODE_ENV=" + mal["NODE_ENV"])
print("APP_URL=" + mal["APP_URL"])
print("ALLOWED_ORIGINS=" + mal["ALLOWED_ORIGINS"])
print("DEV_OTP=" + mal["DEV_OTP"])
print("NI_BASE_URL=" + ("set" if unquote(mal.get("NI_BASE_URL", "")).strip() else "missing"))
print("DAFTRA_REDIRECT=" + mal["DAFTRA_OAUTH_REDIRECT_URI"])
PY

mkdir -p /opt/sarh-butcher/secrets
if [[ ! -s /opt/sarh-butcher/secrets/firebase-private-key.pem ]]; then
  printf '%s\n' '-----BEGIN PRIVATE KEY-----' 'UNSET' '-----END PRIVATE KEY-----' \
    > /opt/sarh-butcher/secrets/firebase-private-key.pem
  chmod 600 /opt/sarh-butcher/secrets/firebase-private-key.pem
fi

echo "=== rebuild and recreate Malahem API stack ==="
docker compose -f docker-compose.vps.yml build butcher-api
docker compose -f docker-compose.vps.yml up -d \
  butcher-postgres butcher-redis butcher-api worker butcher-socket

echo "=== customer web on :3104 ==="
docker compose -f docker-compose.vps.yml --profile frontends build web
docker compose -f docker-compose.vps.yml --profile frontends up -d web

# Keep Malahem off sarh_internal if a leftover attach exists.
for c in sarh-butcher-butcher-api-1 sarh-butcher-butcher-socket-1 sarh-butcher-worker-1 \
         sarh-butcher-admin-1 sarh-butcher-butcher-1 sarh-butcher-web-1; do
  docker network disconnect sarh_internal "$c" 2>/dev/null || true
done

echo "=== recreate Sarh nginx with Malahem SNI overlay ==="
cd /opt/sarh
docker compose -f docker-compose.prod.yml -f docker-compose.prod.ssl.yml \
  -f /opt/sarh-butcher/docker-compose.sarh-edge.yml \
  --env-file .env.production up -d --force-recreate --no-deps nginx
sleep 2
docker exec sarh-nginx-1 nginx -t
curl -sS -m 10 -o /dev/null -w 'sarh_https=%{http_code}\n' https://sarhsa.online/api/health
curl -sS -m 10 -o /dev/null -w 'malahem_http_health=%{http_code}\n' \
  http://malahem.sarhsa.online/api/health || true

echo "=== issue / reuse Malahem certificate ==="
if [[ ! -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ]]; then
  docker run --rm \
    -v /etc/letsencrypt:/etc/letsencrypt \
    -v /var/www/certbot:/var/www/certbot \
    certbot/certbot certonly --webroot -w /var/www/certbot \
    -d "${DOMAIN}" --agree-tos --non-interactive --keep-until-expiring \
    --email sarh@sarhsa.online || {
      echo "CERTBOT_FAILED"
      exit 20
    }
fi

if [[ -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ]]; then
  if ! grep -q "server_name ${DOMAIN};" /opt/sarh-butcher/nginx/hostinger-ssl.conf; then
    printf '\n' >> /opt/sarh-butcher/nginx/hostinger-ssl.conf
    cat /opt/sarh-butcher/nginx/malahem-sni-ssl.conf >> /opt/sarh-butcher/nginx/hostinger-ssl.conf
  fi
  cd /opt/sarh
  docker compose -f docker-compose.prod.yml -f docker-compose.prod.ssl.yml \
    -f /opt/sarh-butcher/docker-compose.sarh-edge.yml \
    --env-file .env.production up -d --force-recreate --no-deps nginx
  sleep 2
  docker exec sarh-nginx-1 nginx -t
fi

cd /opt/sarh-butcher
echo "=== public checks ==="
curl -sS -m 15 -o /dev/null -w 'sarh_https=%{http_code}\n' https://sarhsa.online/api/health
curl -sS -m 15 -o /dev/null -w 'malahem_https_health=%{http_code}\n' https://${DOMAIN}/api/health || true
curl -sS -m 10 -o /dev/null -w 'malahem_https_ready=%{http_code}\n' https://${DOMAIN}/api/health/ready || true
root_loc=$(curl -sSI -m 15 "https://${DOMAIN}/" | tr -d '\r' | awk 'tolower($1)=="location:"{print $2; exit}')
echo "malahem_https_root_location=${root_loc:-none}"
echo DONE
