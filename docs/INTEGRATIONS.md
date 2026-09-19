# Integrations

| System | Phase 1 status | Isolation |
|---|---|---|
| N-Genius | Code copied; credentials empty | New outlet + webhook |
| Daftra | Module copied | New `SECRETS_ENCRYPTION_KEY`; new OAuth redirect; worker lock `butcherapp:cron:daftra_products:{id}` |
| Cloudinary | Code copied | `CLOUDINARY_FOLDER=sarh-butcher` — do not use `safat`. Old SARH images are not deleted. |
| Twilio | Code copied | New Verify SID |
| Expo Push | Code copied | New FCM/APNs for `com.sarh.butcher` — SARH google-services **not copied** |
| Sentry | Optional | New DSN |
