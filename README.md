# ملاحم سرح

تطبيق سوق الملاحم المستقل. ليس forkًا لمستودع SARH، ولا يشارك قاعدة بياناته أو Redis أو JWT أو webhook المدفوعات.

**العرض:** ملاحم سرح  
**المستودع:** `sarh-butcher`  
**المصدر:** نسخ مضبوط من نطاق الملاحم في [sarh.app](https://github.com/iiimmcc30-create/sarh.app) — COPY → ADAPT → VERIFY.  
**SARH الأصلي لم يُعدَّل بهذه العملية.**

## Stack

| طبقة | تقنية |
|---|---|
| Mobile | Expo / React Native / Expo Router / TypeScript |
| Backend | NestJS + Prisma + PostgreSQL |
| Realtime | Socket.IO (عملية مستقلة) |
| Jobs | Redis + BullMQ (عملية worker مستقلة) |
| Dashboard | Next.js (`butcher-dashboard`) |
| Admin | Next.js (عمليات الملاحم فقط) |
| مدفوعات | N-Genius (outlet + webhook مستقلان) |
| تكاملات | Daftra, Cloudinary, Twilio Verify, Expo Push |

ممنوع Flutter. لا نشر إنتاج في المرحلة 1.

## البنية

```
sarh-butcher/
├── app/                  # تطبيق ملاحم سرح (Expo)
├── backend-nest/         # API + worker + socket
├── butcher-dashboard/    # لوحة الملحمة
├── admin-panel/          # إدارة الملاحم
├── nginx/
├── docker-compose.yml    # تطوير محلي معزول
├── docker-compose.prod.yml
├── .env.example
└── docs/
```

## الهوية (مستقلة عن SARH)

| | SARH | ملاحم سرح |
|---|---|---|
| Android | `com.sarh.app` | `com.sarh.butcher` |
| iOS | `com.sarh.app` | `com.sarh.butcher` |
| Scheme | `sarh` | `malahm` |
| Expo slug | `safat` | `malahm-sarh` |
| DB | `sarh` | `sarh_butcher` |
| Redis prefix | none | `butcherapp:` |

## تشغيل محلي (بعد ملء `.env`)

```bash
cp .env.example .env
docker compose up -d postgres redis
cd backend-nest && npm ci && npx prisma migrate deploy && npm run start:dev
# worker / socket في طرفيات منفصلة
cd ../app && npm ci && npx expo start
```

لا تستخدم `DATABASE_URL` أو `REDIS_URL` أو `JWT_SECRET` أو webhook N-Genius الخاص بإنتاج SARH.

التوثيق: `docs/EXTRACTION.md` وبقية ملفات `docs/`.
