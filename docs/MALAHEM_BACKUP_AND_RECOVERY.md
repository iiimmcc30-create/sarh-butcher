# Malahem backup and recovery (runbook)

This is a **policy**. The repository does not ship a live backup job.  
Do not claim backups exist until operators enable them.

Fresh launch: the first dump is of an **empty** `sarh_butcher` after `prisma migrate deploy`. Enable daily dumps **before** public traffic.

---

## PostgreSQL (mandatory)

| Item | Recommendation |
| ---- | -------------- |
| What | Database `sarh_butcher` only |
| Method | Daily `pg_dump` (custom format) + WAL/PITR if the host is managed |
| Retention | 14–30 days daily; weekly copies longer |
| Restore target | A **new** Malahem instance. Never restore onto `sarouh`. |
| RPO | ≤ 24h (≤ 5 min with PITR) |
| Verify | Quarterly restore to a scratch database + `prisma migrate status` |

SAFE TO RUN LOCALLY (local compose only):

```bash
pg_dump --format=custom --file=/tmp/sarh_butcher.local.dump \
  "$MALAHEM_DATABASE_URL"
```

PRODUCTION — RUN ONLY AFTER EXPLICIT APPROVAL: same command against the production URL, stored off-box.

---

## Redis

Redis holds sessions, rate-limit counters, BullMQ jobs, Daftra sync locks, worker heartbeat.

| Item | Recommendation |
| ---- | -------------- |
| Persistence | Compose already enables AOF (`--appendonly yes`) |
| Backup | Optional snapshot if job-loss on rebuild is unacceptable |
| Restore | Prefer **rebuild**: users re-login; queues drain empty |
| Isolation | Never persist/restore onto host `:6379` (Sarh) |

Treat Redis as **ephemeral but isolated**. Postgres is the system of record for orders/payments.

---

## Uploaded media (Cloudinary)

| Item | Recommendation |
| ---- | -------------- |
| Folder | `sarh-butcher` |
| Recovery | Cloudinary account backup / original uploads |
| Deletion | Application deletes Cloudinary objects on some update paths; dumps do not restore binaries |

Do not point production at folder `safat` or `sarh`.

---

## Secrets

| Item | Recommendation |
| ---- | -------------- |
| What | JWT pair, NI, Twilio, Cloudinary, Firebase, Daftra encryption key, DB/Redis passwords, `CRON_SECRET` |
| Where | Operator secret store (not git, not Sarh `.env`) |
| Rotation | Possible with dual-JWT window; NI/Twilio need provider-side rotation |

Losing `SECRETS_ENCRYPTION_KEY` makes stored Daftra tokens unreadable.

---

## Payments / finance records

Keep `Payment` + `IntegrationWebhookEvent` + NI portal export. Retention: finance policy (years).  
Reconcile `needsReconciliation` and `MALAHM-` vs leftover `SFAT-`.

---

## Restore sequence (destination only)

1. Provision empty Postgres `sarh_butcher`.
2. Restore dump.
3. `prisma migrate status` then `migrate deploy` if the dump is from an older schema.
4. Start Redis empty (or restore AOF if required).
5. Start worker → api → socket.
6. `GET /api/health/ready`.
7. Smoke test login + one order read.

PRODUCTION — RUN ONLY AFTER EXPLICIT APPROVAL.
