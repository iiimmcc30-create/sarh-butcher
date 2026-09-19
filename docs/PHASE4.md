# Phase 4 — Independent Hostinger edge + EAS test APK

Work tree: `/home/ubuntu/sarh-butcher` only. `/workspace` was not edited.
SARH GitHub repo was not modified. No merge to `main`. No production AAB.

## Git baseline

| Item | Value |
|---|---|
| Branch | `cursor/butcher-deployment-eas-phase-4` |
| Parent | `cursor/butcher-runtime-validation-phase-3` @ `e2ac532` |
| HEAD | `e5e1783` |
| Remote | `https://github.com/iiimmcc30-create/sarh-butcher.git` exists (empty) |
| Push | BLOCKED — `gh`/git credential is `cursor`; private repo is owned by `iiimmcc30-create` (`repository not found`) |
| Secrets tracked | NO (`.env` gitignored; Render example identifiers sanitized) |

## Live Hostinger (inspected, not guessed)

- VPS `root@92.113.25.157`, compose project `sarh`
- SARH: `sarh-api-1 :3001`, `sarh-socket-1 :3002`, `sarh-nginx-1 :80/:443`
- Before change: `/api/butcher/*` fell through SARH `location /api/` (404)
- Backup: `/opt/backups/sarh-butcher-phase4/20260919T034626Z`
- Independent stack: `/opt/sarh-butcher` + `docker-compose.vps.yml`
  - Postgres `butcher-postgres` / db `sarh_butcher`
  - Redis `butcher-redis` / prefix `butcherapp:`
  - API `127.0.0.1:3101`, socket `127.0.0.1:3102`
  - `NODE_ENV=staging` so mock NI + `DEV_OTP=true` + local storage can boot
- Nginx overlay only (SARH git not committed):
  - `/opt/sarh-butcher/docker-compose.nginx-edge.yml`
  - `nginx -t` PASS then reload
- Isolation proof (uptime): butcher `/api/butcher/health` ≈ minutes; SARH `/api/health` ≈ 18h
- `/api/butchers` still returns SARH directory; `/api/butcher/butchers` is the empty isolated DB
- SARH `/socket.io/` unchanged; butcher `/api/butcher/socket.io/` independent
- SARH Redis `butcherapp:*` count = 0 after unique DNS names

## EAS

- First project `@alsafa00/malahm-sarh` (`d04e5c49-9668-499a-a912-4acea773191f`) — free Android quota exhausted
- Linked `@sarh000/malahm-sarh` (`66fbef22-4a7b-45de-9280-c4dc8d7afb80`) — **not** SARH `fc410a8a-09ab-49bb-ba66-53c86471e9aa`
- New Android keystore created for `com.sarh.butcher` (SARH `com.sarh.app` keystore untouched)
- Native leftover `android/` still had `com.sarh.app` + `sarh://` — EAS ignores `app.json` when `android/` exists. Fixed.
- First queued build `665f6140-…` ERRORED: `google-services` plugin without `google-services.json`
- Second build `2073fe7a-6e9e-465d-b3bf-f804d4286464` FINISHED

## APK inspection (`/tmp/malahm-sarh-preview.apk`, 375M)

| Check | Result |
|---|---|
| AndroidManifest package | `com.sarh.butcher` |
| Scheme | `malahm` + `exp+malahm-sarh` |
| JS API | `https://sarhsa.online/api/butcher` present |
| JS socket path | `/api/butcher/socket.io` present |
| `sarhsa.online/api"` generic | absent |
| `sarh-new4.onrender.com` | absent |
| SARH EAS projectId | absent |
| `com.sarh.app` in JS | leftover Play Store link in unused `(tabs)/more.tsx` only |

No emulator/device in this environment — APK smoke on a phone is the next operator step.

```
PHASE 4 — FINAL REPORT

Repository:
https://github.com/iiimmcc30-create/sarh-butcher.git

Branch:
cursor/butcher-deployment-eas-phase-4

Commit:
e5e1783dc28ad3e76c343f3684564f80cb25cca1

Nginx:
PASS

Butcher API public route:
https://sarhsa.online/api/butcher

SARH API isolation:
PASS

EAS:
PASS

EAS Project ID:
66fbef22-4a7b-45de-9280-c4dc8d7afb80

SARH Project ID reused:
NO

Android package:
com.sarh.butcher

Scheme:
malahm

Build profile:
preview

Build ID:
2073fe7a-6e9e-465d-b3bf-f804d4286464

Build status:
FINISHED

APK:
https://expo.dev/artifacts/eas/3DQJPe0P7qMl7yAe1ko4fgLzV9Sw_8hMBculST7cpfY.apk

API inside build:
https://sarhsa.online/api/butcher

Socket:
https://sarhsa.online
path=/api/butcher/socket.io

Payment:
MOCK/TEST ONLY

Production N-Genius:
NOT ENABLED

Daftra:
NOT ENABLED

FCM/APNs:
NOT ENABLED

Secrets leaked:
NO

SARH project modified:
NO

SARH DB modified:
NO

SARH Redis modified:
NO

SARH EAS project modified:
NO

Final status:
READY FOR ANDROID TESTING
```

## Remaining

```
BLOCKER      git push to iiimmcc30-create/sarh-butcher (credential is cursor, repo private/empty)
NON-BLOCKER  Device/emulator smoke not run here
NON-BLOCKER  Future SARH `04-deploy.sh` must also pass docker-compose.nginx-edge.yml or routing reverts
NON-BLOCKER  Leftover Play Store com.sarh.app link on unused more.tsx
INTENTIONAL  Compat /api/butcher/api/* kept
INTENTIONAL  NODE_ENV=staging on VPS so mock payment/DEV_OTP can boot
INTENTIONAL  No production NI / FCM / Daftra
```
