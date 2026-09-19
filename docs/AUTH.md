# Authentication — independent

- Same Nest JWT + refresh + `passwordVersion` + Redis blacklist **code**, new secrets.
- `JWT_SECRET` and `JWT_REFRESH_SECRET` must **not** equal SARH values.
- Butcher dashboard cookie `butcher_token` verifies HS256 with **this** API secret and `role === 'BUTCHER'`.
- Admin cookie `admin_token` same pattern.
- OTP: Twilio Verify **new service SID**. `DEV_OTP=true` for local only.
- Join phone token `purpose: 'join'` signed with this JWT secret.
- User rows live only in `sarh_butcher`. No shared SARH user IDs at runtime.

Do not accept SARH tokens. Federation is out of scope.
