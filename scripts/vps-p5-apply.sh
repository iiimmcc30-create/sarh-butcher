#!/usr/bin/env bash
# Run ON the VPS as root from /opt/sarh-butcher.
# Isolates Malahem from sarh_internal, copies shared provider keys from
# /opt/sarh/.env.production into the existing Malahem .env (does not overwrite
# JWT/encryption secrets), then recreates the API stack without binding :80.
set -euo pipefail
cd /opt/sarh-butcher

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
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
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

mal = parse(mal_path)
sarh = parse(sarh_path)
order = list(mal.keys())

# Never overwrite independent Malahem secrets.
protect = {
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    "BUTCHER_JWT_SECRET",
    "BUTCHER_JWT_REFRESH_SECRET",
    "SECRETS_ENCRYPTION_KEY",
    "CRON_SECRET",
    "POSTGRES_PASSWORD",
    "POSTGRES_USER",
    "POSTGRES_DB",
    "JWT_ISSUER",
    "REDIS_KEY_PREFIX",
    "CLOUDINARY_FOLDER",
    "APP_DEEP_LINK_SCHEME",
    "APP_ANDROID_PACKAGE",
}

share = [
    "NI_API_KEY",
    "NI_OUTLET_ID",
    "NI_WEBHOOK_SECRET",
    "NI_API_BASE",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_VERIFY_SERVICE_SID",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "DAFTRA_OAUTH_CLIENT_ID",
    "DAFTRA_OAUTH_CLIENT_SECRET",
    "SENTRY_DSN",
]
copied = []
for key in share:
    if key in protect:
        continue
    incoming = sarh.get(key, "").strip()
    current = mal.get(key, "").strip()
    if incoming and not current:
        mal[key] = sarh[key]
        copied.append(key)

mal["JWT_ISSUER"] = "malahm-sarh"
mal["REDIS_KEY_PREFIX"] = "butcherapp:"
mal["CLOUDINARY_FOLDER"] = "sarh-butcher"
mal["APP_DEEP_LINK_SCHEME"] = "malahm"
mal["APP_ANDROID_PACKAGE"] = "com.sarh.butcher"
mal["POSTGRES_DB"] = mal.get("POSTGRES_DB") or "sarh_butcher"
mal.setdefault("BUTCHER_JWT_SECRET", mal.get("JWT_SECRET", ""))
mal.setdefault("SKIP_MIGRATIONS", "true")
# Stay staging until MALAHEM_DOMAIN exists (production validator rejects empty/sarh origins).
mal["NODE_ENV"] = "staging"
mal["DEV_OTP"] = "false" if mal.get("TWILIO_ACCOUNT_SID", "").strip() else mal.get("DEV_OTP", "true")

# Strip Sarh public hostname. Internal loopback until operator DNS exists.
for key in (
    "APP_URL",
    "PUBLIC_API_URL",
    "PUBLIC_SOCKET_URL",
    "MALAHEM_APP_URL",
    "MALAHEM_API_URL",
    "ALLOWED_ORIGINS",
    "DAFTRA_OAUTH_REDIRECT_URI",
):
    value = mal.get(key, "")
    if "sarhsa.online" in value:
        mal.pop(key, None)

mal["APP_URL"] = "http://127.0.0.1:3101"
mal["PUBLIC_API_URL"] = "http://127.0.0.1:3101"
mal["PUBLIC_SOCKET_URL"] = "http://127.0.0.1:3102"
mal["MALAHEM_APP_URL"] = "http://127.0.0.1:3101"
mal["MALAHEM_API_URL"] = "http://127.0.0.1:3101"
mal["ALLOWED_ORIGINS"] = "http://127.0.0.1:3100,http://127.0.0.1:3103"
mal["DAFTRA_OAUTH_REDIRECT_URI"] = "http://127.0.0.1:3101/api/butchers/daftra/oauth/callback"

write(mal_path, mal, order)
print("PROVIDER_COPIED=" + ",".join(copied) if copied else "PROVIDER_COPIED=none")
print("DEV_OTP=" + mal.get("DEV_OTP", ""))
print("TWILIO=" + ("set" if mal.get("TWILIO_ACCOUNT_SID", "").strip() else "missing"))
print("NI=" + ("set" if mal.get("NI_API_KEY", "").strip() else "missing"))
print("CLOUDINARY=" + ("set" if mal.get("CLOUDINARY_API_KEY", "").strip() else "missing"))
print("FIREBASE=" + ("set" if mal.get("FIREBASE_PROJECT_ID", "").strip() else "missing"))
PY

# Disconnect leftover Sarh network attachments before recreate.
for c in sarh-butcher-butcher-api-1 sarh-butcher-butcher-socket-1 sarh-butcher-worker-1; do
  docker network disconnect sarh_internal "$c" 2>/dev/null || true
done

docker compose -f docker-compose.vps.yml up -d --no-build \
  butcher-postgres butcher-redis butcher-api worker butcher-socket

sleep 4
for c in sarh-butcher-butcher-api-1 sarh-butcher-butcher-socket-1 sarh-butcher-worker-1; do
  docker network disconnect sarh_internal "$c" 2>/dev/null || true
  echo -n "$c networks: "
  docker inspect "$c" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
done

echo "=== health ==="
curl -sS -m 10 http://127.0.0.1:3101/api/health || true
echo
curl -sS -m 10 http://127.0.0.1:3101/api/health/ready || true
echo
curl -sS -m 8 http://127.0.0.1:3102/health || true
echo
echo "=== migrate status ==="
docker exec sarh-butcher-butcher-api-1 npx prisma migrate status || true
echo "=== redis heartbeat ==="
docker exec sarh-butcher-butcher-redis-1 redis-cli GET butcherapp:worker:heartbeat || true
echo
echo "=== db ==="
docker exec sarh-butcher-butcher-postgres-1 psql -U butcher -d sarh_butcher -tAc "select current_database(), (select count(*) from \"User\"), (select count(*) from \"Butcher\")"
