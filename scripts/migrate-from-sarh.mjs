#!/usr/bin/env node
/**
 * HISTORICAL / OPTIONAL EXTRACTION TOOL — NOT PART OF PRODUCTION LAUNCH.
 *
 * Malahem production starts with a clean PostgreSQL database and zero
 * migrated users/data. Do not run this script as a launch step.
 *
 * Extract butcher-domain rows from a READ-ONLY local/staging Sarh source DB
 * into an independent Malahem database.
 *
 * NEVER points at production by default.
 * NEVER writes to the source.
 *
 * Usage:
 *   SARH_SOURCE_DATABASE_URL=postgresql://... \
 *   MALAHEM_DATABASE_URL=postgresql://... \
 *   node scripts/migrate-from-sarh.mjs --dry-run
 *
 *   node scripts/migrate-from-sarh.mjs --execute
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DRY = !process.argv.includes('--execute');
const ALLOW_HOSTED = process.argv.includes('--allow-hosted');

function requireUrl(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing ${name}. Refusing to guess a production URL.`);
    process.exit(1);
  }
  if (/sarhsa\.online|render\.com|railway\.app/i.test(value)) {
    if (DRY && !ALLOW_HOSTED) {
      console.error(
        `${name} looks like a hosted URL. Dry-run refused. Use a local snapshot, or pass --allow-hosted only after review.`,
      );
      process.exit(1);
    }
    if (!DRY && !ALLOW_HOSTED) {
      console.error(
        `${name} looks like a hosted URL. Refusing --execute without --allow-hosted.`,
      );
      process.exit(1);
    }
  }
  return value;
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Usage:
  SARH_SOURCE_DATABASE_URL=... MALAHEM_DATABASE_URL=... \\
    node scripts/migrate-from-sarh.mjs --dry-run

Guards run before Prisma loads:
  - both URLs required
  - source !== destination
  - hosted URLs refused unless --allow-hosted
  - --execute writes to destination only
`);
  process.exit(0);
}

const sourceUrl = requireUrl('SARH_SOURCE_DATABASE_URL');
const destUrl = requireUrl('MALAHEM_DATABASE_URL');

if (sourceUrl === destUrl) {
  console.error('Source and destination DATABASE URLs must differ.');
  process.exit(1);
}

function databaseName(url) {
  try {
    return new URL(url).pathname.replace(/^\//, '').split('?')[0] || '';
  } catch {
    return '';
  }
}

if (databaseName(destUrl) === 'sarouh') {
  console.error('MALAHEM_DATABASE_URL must not target the Sarh database name sarouh.');
  process.exit(1);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const backendPkg = join(scriptDir, '../backend-nest/package.json');
let PrismaClient;
try {
  ({ PrismaClient } = createRequire(backendPkg)('@prisma/client'));
} catch (err) {
  console.error(
    'Cannot load @prisma/client from backend-nest. Run npm install in backend-nest first.',
  );
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
const dest = new PrismaClient({ datasources: { db: { url: destUrl } } });

const USER_SELECT = {
  id: true,
  username: true,
  email: true,
  phone: true,
  passwordHash: true,
  passwordVersion: true,
  displayName: true,
  arabicName: true,
  avatar: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

async function collectUserIds() {
  const [butchers, orders, apps, favorites, reviews] = await Promise.all([
    source.butcher.findMany({ select: { userId: true } }),
    source.butcherOrder.findMany({ select: { customerId: true } }),
    source.butcherApplication.findMany({ select: { userId: true } }),
    source.butcherFavorite.findMany({ select: { userId: true } }),
    source.butcherReview.findMany({ select: { reviewerId: true } }),
  ]);
  return new Set(
    [
      ...butchers.map((r) => r.userId),
      ...orders.map((r) => r.customerId),
      ...apps.map((r) => r.userId),
      ...favorites.map((r) => r.userId),
      ...reviews.map((r) => r.reviewerId),
    ].filter(Boolean),
  );
}

async function main() {
  console.log(DRY ? 'DRY-RUN — no writes' : 'EXECUTE — writing to Malahem DB only');
  const userIds = [...(await collectUserIds())];
  const butchers = await source.butcher.findMany();
  const products = await source.butcherProduct.findMany();
  const orders = await source.butcherOrder.findMany();
  const items = await source.butcherOrderItem.findMany();
  const checkouts = await source.butcherCheckout.findMany();
  const reservations = await source.butcherCheckoutReservation.findMany();
  const payments = await source.payment.findMany({
    where: {
      OR: [
        { butcherOrder: { isNot: null } },
        { butcherCheckout: { isNot: null } },
        { orderId: { startsWith: 'BOC-' } },
        { orderId: { startsWith: 'MALAHM-' } },
        { orderId: { startsWith: 'SFAT-' } },
      ],
    },
  });

  const report = {
    users: userIds.length,
    butchers: butchers.length,
    products: products.length,
    orders: orders.length,
    orderItems: items.length,
    checkouts: checkouts.length,
    reservations: reservations.length,
    payments: payments.length,
  };
  console.log(JSON.stringify({ counts: report }, null, 2));

  if (DRY) {
    console.log('Re-run with --execute after reviewing counts on a staging destination.');
    return;
  }

  const users = await source.user.findMany({
    where: { id: { in: userIds } },
    select: USER_SELECT,
  });

  for (const user of users) {
    await dest.user.upsert({
      where: { id: user.id },
      create: user,
      update: user,
    });
  }
  for (const row of butchers) {
    await dest.butcher.upsert({ where: { id: row.id }, create: row, update: row });
  }
  for (const row of products) {
    await dest.butcherProduct.upsert({ where: { id: row.id }, create: row, update: row });
  }
  for (const row of payments) {
    await dest.payment.upsert({ where: { id: row.id }, create: row, update: row });
  }
  for (const row of checkouts) {
    await dest.butcherCheckout.upsert({ where: { id: row.id }, create: row, update: row });
  }
  for (const row of reservations) {
    await dest.butcherCheckoutReservation.upsert({
      where: { id: row.id },
      create: row,
      update: row,
    });
  }
  for (const row of orders) {
    await dest.butcherOrder.upsert({ where: { id: row.id }, create: row, update: row });
  }
  for (const row of items) {
    await dest.butcherOrderItem.upsert({ where: { id: row.id }, create: row, update: row });
  }

  console.log('Copy complete. Sessions were not copied — users must log in again.');
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await source.$disconnect().catch(() => undefined);
    await dest.$disconnect().catch(() => undefined);
  });
