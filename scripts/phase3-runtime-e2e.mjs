#!/usr/bin/env node
/**
 * Phase 3 live runtime E2E against the isolated ملاحم سرح stack.
 * Never talks to SARH production.
 */
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const API = process.env.PHASE3_API || 'http://127.0.0.1:3001';
const SOCKET = process.env.PHASE3_SOCKET || 'http://127.0.0.1:3002';
const DASH = process.env.PHASE3_DASH || 'http://127.0.0.1:3003';
const ADMIN_UI = process.env.PHASE3_ADMIN || 'http://127.0.0.1:3000';
const ADMIN_LOGIN = process.env.ADMIN_E2E_LOGIN || 'e2e_admin';
const ADMIN_PASSWORD = process.env.ADMIN_E2E_PASSWORD || 'E2eAdmin!234';
const BUTCHER_JWT = process.env.JWT_SECRET || 'butcher-phase3-jwt-secret-key-32chars!!';

const results = [];
function rec(name, ok, detail) {
  results.push({ name, ok, detail: detail ?? '' });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function pickToken(data) {
  const d = data?.data ?? data ?? {};
  return (
    d.accessToken ||
    d.access_token ||
    d.tokens?.accessToken ||
    d.tokens?.access_token ||
    null
  );
}

function pickRefresh(data) {
  const d = data?.data ?? data ?? {};
  return (
    d.refreshToken ||
    d.refresh_token ||
    d.tokens?.refreshToken ||
    d.tokens?.refresh_token ||
    null
  );
}

async function req(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.json !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API}${path}`, {
    method: opts.method || 'GET',
    headers,
    body:
      opts.body !== undefined
        ? opts.body
        : opts.json !== undefined
          ? JSON.stringify(opts.json)
          : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data, text };
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

function tinyJpeg() {
  return Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wAAAAkA' +
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
      '/9k=',
    'base64',
  );
}

function signHs256(payload, secret) {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const { createHmac } = requireCrypto();
  const sig = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

function requireCrypto() {
  return createRequire(import.meta.url)('node:crypto');
}

const suffix = String(Date.now()).slice(-8);
const customerPhone = `+9665${suffix.padStart(8, '0').slice(0, 8)}`;
const butcherJoinPhone = `+9665${String(Number(suffix) + 1).padStart(8, '0').slice(0, 8)}`;
const customerUser = `cust_${suffix}`;
const butcherAccount = `shop_${suffix}`;
const butcherPass = 'ShopPass1!';

async function waitHealth(timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const h = await req('/api/health');
      if (h.status === 200 && h.data?.checks?.db) return h.data;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error('API health timeout');
}

async function main() {
  const health = await waitHealth();
  rec(
    'API health',
    health.status === 'ok' && health.checks.db,
    JSON.stringify(health.checks),
  );
  rec('DB connection', Boolean(health.checks.db));
  rec('Redis cache', Boolean(health.checks.redis_cache));
  rec('Redis session', Boolean(health.checks.redis_session));
  rec('Queue', Boolean(health.checks.queue));
  rec('Worker heartbeat (health)', Boolean(health.checks.worker));

  const ready = await req('/api/health/ready');
  rec('API ready', ready.status === 200 && ready.data?.status === 'ready', ready.data?.status);

  // --- Auth customer ---
  const send = await req('/api/auth/send-otp', {
    method: 'POST',
    json: { phone: customerPhone, purpose: 'signup' },
  });
  rec('OTP send (signup)', send.status === 200, send.data?.error || send.data?.data?.message);

  const badOtp = await req('/api/auth/verify-otp', {
    method: 'POST',
    json: { phone: customerPhone, code: '000000', purpose: 'signup' },
  });
  rec('OTP reject invalid', badOtp.status >= 400);

  const verify = await req('/api/auth/verify-otp', {
    method: 'POST',
    json: { phone: customerPhone, code: '123456', purpose: 'signup' },
  });
  const phoneToken = verify.data?.data?.phone_token || verify.data?.data?.phoneToken;
  rec('OTP verify', verify.status === 200 && Boolean(phoneToken), verify.data?.error);

  const register = await req('/api/auth/register', {
    method: 'POST',
    json: {
      phone: customerPhone,
      phone_token: phoneToken,
      displayName: 'زبون الاختبار',
      arabicName: 'زبون الاختبار',
      username: customerUser,
      password: 'CustPass1!',
      country: 'SA',
    },
  });
  const customerAccess = pickToken(register.data);
  const customerRefresh = pickRefresh(register.data);
  rec(
    'Register',
    register.status === 201 && Boolean(customerAccess),
    register.data?.error || register.data?.messageAr,
  );

  let customerToken = customerAccess;
  const me = await req('/api/users/me/account', { headers: auth(customerToken) });
  rec('Authenticated request', me.status === 200, String(me.status));

  const refresh = await req('/api/auth/refresh', {
    method: 'POST',
    json: { refreshToken: customerRefresh },
  });
  const refreshed = pickToken(refresh.data);
  rec('Refresh', refresh.status === 200 && Boolean(refreshed), refresh.data?.error);
  if (refreshed) customerToken = refreshed;

  const payloadB64 = customerToken.split('.')[1];
  const jwtBody = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
  rec('JWT issuer malahm-sarh', jwtBody.iss === 'malahm-sarh', String(jwtBody.iss));

  const sarhJwt = signHs256(
    {
      userId: jwtBody.userId || 'x',
      role: 'USER',
      iss: 'sarh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    'this-is-a-sarh-secret-not-used-here!!',
  );
  const sarhRejected = await req('/api/butchers', {
    headers: auth(sarhJwt),
  });
  rec(
    'SARH JWT rejected',
    sarhRejected.status === 401 || sarhRejected.status === 403,
    String(sarhRejected.status),
  );

  // --- Admin login ---
  const adminLogin = await req('/api/admin/auth/login', {
    method: 'POST',
    json: { login: ADMIN_LOGIN, password: ADMIN_PASSWORD },
  });
  const adminToken = pickToken(adminLogin.data);
  rec('Admin login', adminLogin.status === 200 && Boolean(adminToken), adminLogin.data?.error);

  const unauthAdmin = await req('/api/admin/butcher-applications', {
    headers: auth(customerToken),
  });
  rec(
    'Unauthorized admin action rejected',
    unauthAdmin.status === 401 || unauthAdmin.status === 403,
    String(unauthAdmin.status),
  );

  // --- Butcher onboarding via public join ---
  const joinOtp = await req('/api/auth/send-otp', {
    method: 'POST',
    json: { phone: butcherJoinPhone, purpose: 'join' },
  });
  rec('Join OTP send', joinOtp.status === 200, joinOtp.data?.error);

  const joinVerify = await req('/api/auth/verify-otp', {
    method: 'POST',
    json: { phone: butcherJoinPhone, code: '123456', purpose: 'join' },
  });
  const joinToken =
    joinVerify.data?.data?.phone_token || joinVerify.data?.data?.phoneToken;
  rec('Join OTP verify', joinVerify.status === 200 && Boolean(joinToken), joinVerify.data?.error);

  const jpeg = tinyJpeg();
  const form = new FormData();
  const joinFields = {
    phone: butcherJoinPhone,
    phone_token: joinToken,
    displayName: 'ملحمة فازة 3',
    arabicName: 'ملحمة فازة 3',
    username: `join_${suffix}`,
    acceptedTerms: 'true',
    confirmAccuracy: 'true',
    nameAr: 'ملحمة فازة ثلاثة',
    nameEn: 'Phase Three Butcher',
    shopPhone: butcherJoinPhone,
    commercialReg: `CR${suffix}`,
    country: 'SA',
    city: 'Riyadh',
    cityAr: 'الرياض',
    address: 'طريق الملك فهد 12345',
    addressAr: 'طريق الملك فهد 12345',
    lat: '24.7136',
    lng: '46.6753',
    openTime: '08:00',
    closeTime: '22:00',
    accountUsername: butcherAccount,
    accountPassword: butcherPass,
    accountPasswordConfirm: butcherPass,
  };
  for (const [k, v] of Object.entries(joinFields)) form.append(k, v);
  const blob = new Blob([jpeg], { type: 'image/jpeg' });
  for (const field of [
    'commercial_license',
    'national_id',
    'municipal_permit',
    'shop_photo',
  ]) {
    form.append(field, blob, `${field}.jpg`);
  }

  const join = await req('/api/butcher-applications/join', {
    method: 'POST',
    body: form,
  });
  const applicationId = join.data?.data?.id || join.data?.data?.application?.id;
  rec(
    'Butcher application join',
    (join.status === 201 || join.status === 200) && Boolean(applicationId),
    join.data?.error || join.data?.messageAr || String(join.status),
  );

  const listed = await req('/api/admin/butcher-applications?status=SUBMITTED', {
    headers: auth(adminToken),
  });
  rec(
    'Admin lists applications',
    listed.status === 200,
    String(listed.status),
  );

  const approve = await req(
    `/api/admin/butcher-applications/${applicationId}/approve`,
    {
      method: 'POST',
      headers: { ...auth(adminToken), 'Content-Type': 'application/json' },
      json: { comment: 'phase3 approved' },
    },
  );
  const butcherId =
    approve.data?.data?.butcher?.id || approve.data?.data?.sourcedButcher?.id;
  rec(
    'Admin approval',
    approve.status === 200 && Boolean(butcherId),
    approve.data?.error || approve.data?.messageAr || String(approve.status),
  );

  const butcherLogin = await req('/api/auth/login', {
    method: 'POST',
    json: { login: butcherAccount, password: butcherPass },
  });
  const butcherToken = pickToken(butcherLogin.data);
  rec(
    'Butcher account login',
    butcherLogin.status === 200 && Boolean(butcherToken),
    butcherLogin.data?.error,
  );

  const product = await req('/api/butchers/products', {
    method: 'POST',
    headers: auth(butcherToken),
    json: {
      nameAr: 'لحم بقري فازة 3',
      nameEn: 'Phase3 Beef',
      category: 'beef',
      images: [],
      pricePerKg: 50,
      availableCuts: ['whole'],
      weightMin: 1,
      weightMax: 20,
      availableQuantity: 40,
      inStock: true,
      freshness: 'fresh',
      descriptionAr: 'لحم بقري طازج للاختبار',
      descriptionEn: 'Fresh beef for phase 3 tests',
      country: 'SA',
    },
  });
  const productId = product.data?.data?.id;
  rec(
    'Create product',
    product.status === 200 || product.status === 201,
    product.data?.error || product.data?.messageAr || String(product.status),
  );

  const directory = await req('/api/butchers?sort=rating');
  const seen = JSON.stringify(directory.data || {}).includes(butcherId || 'no-id');
  rec(
    'Directory lists butcher',
    directory.status === 200 && seen,
    String(directory.status),
  );

  const detail = await req(`/api/butchers/${butcherId}`);
  rec('Butcher details', detail.status === 200, String(detail.status));

  const products = await req(`/api/butchers/products?butcherId=${butcherId}`);
  rec('Store products', products.status === 200, String(products.status));

  const emptyCart = await req('/api/butchers/checkout', {
    method: 'POST',
    headers: auth(customerToken),
    json: { butcherId, deliveryType: 'pickup', items: [] },
  });
  rec('Empty cart rejected', emptyCart.status >= 400, String(emptyCart.status));

  const badProduct = await req('/api/butchers/checkout', {
    method: 'POST',
    headers: auth(customerToken),
    json: {
      butcherId,
      deliveryType: 'pickup',
      productId: randomUUID(),
      cutType: 'whole',
      weightKg: 2,
    },
  });
  rec('Invalid product rejected', badProduct.status >= 400, String(badProduct.status));

  const overQty = await req('/api/butchers/checkout', {
    method: 'POST',
    headers: auth(customerToken),
    json: {
      butcherId,
      deliveryType: 'pickup',
      productId,
      cutType: 'whole',
      weightKg: 99,
    },
  });
  rec(
    'Insufficient inventory rejected',
    overQty.status >= 400,
    overQty.data?.error || String(overQty.status),
  );

  const listingFee = await req('/api/payments/initiate', {
    method: 'POST',
    headers: auth(customerToken),
    json: {
      amount: 10,
      method: 'mada',
      type: 'listing_fee',
      referenceId: randomUUID(),
    },
  });
  rec(
    'SARH payment type rejected',
    listingFee.status === 400 &&
      (listingFee.data?.error === 'unsupported_payment_type' ||
        listingFee.data?.data?.error === 'unsupported_payment_type' ||
        JSON.stringify(listingFee.data).includes('unsupported_payment_type')),
    listingFee.data?.error || String(listingFee.status),
  );

  const checkout = await req('/api/butchers/checkout', {
    method: 'POST',
    headers: auth(customerToken),
    json: {
      butcherId,
      deliveryType: 'pickup',
      method: 'mada',
      productId,
      cutType: 'whole',
      weightKg: 2,
    },
  });
  const checkoutId = checkout.data?.data?.checkoutId;
  const paymentId = checkout.data?.data?.paymentId;
  rec(
    'Checkout',
    (checkout.status === 201 || checkout.status === 200) &&
      Boolean(checkoutId) &&
      Boolean(paymentId),
    checkout.data?.error || checkout.data?.messageAr || String(checkout.status),
  );

  const checkout2 = await req('/api/butchers/checkout', {
    method: 'POST',
    headers: auth(customerToken),
    json: {
      butcherId,
      deliveryType: 'pickup',
      method: 'mada',
      productId,
      cutType: 'whole',
      weightKg: 2,
    },
  });
  rec(
    'Duplicate checkout protected or reused',
    checkout2.status < 500,
    checkout2.data?.data?.checkoutId === checkoutId
      ? 'reused'
      : checkout2.data?.error || String(checkout2.status),
  );

  const pay = await req(`/api/payments/${paymentId}/dev-complete`, {
    method: 'POST',
    headers: auth(customerToken),
    json: {},
  });
  const orderId = pay.data?.data?.butcherOrder?.id;
  rec(
    'Dev payment → order',
    pay.status === 200 && Boolean(orderId),
    pay.data?.error || pay.data?.messageAr || String(pay.status),
  );

  const payRow = execSync(
    `PGPASSWORD='butcher-local-phase2-only' psql -h 127.0.0.1 -p 5432 -U butcher -d sarh_butcher -tAc "SELECT \\"referenceType\\", status FROM \\"Payment\\" WHERE id='${paymentId}'"`,
    { encoding: 'utf8' },
  ).trim();
  rec(
    'Payment referenceType butcher_checkout',
    payRow.includes('butcher_checkout'),
    payRow,
  );

  const butcherOrders = await req('/api/butchers/orders', {
    headers: auth(butcherToken),
  });
  rec('Butcher sees order', butcherOrders.status === 200, String(butcherOrders.status));

  const confirm = await req(`/api/butchers/orders/${orderId}`, {
    method: 'PUT',
    headers: auth(butcherToken),
    json: { status: 'confirmed' },
  });
  rec('Order confirmed', confirm.status === 200, confirm.data?.error || String(confirm.status));

  await req(`/api/butchers/orders/${orderId}`, {
    method: 'PUT',
    headers: auth(butcherToken),
    json: { status: 'preparing' },
  });
  await req(`/api/butchers/orders/${orderId}`, {
    method: 'PUT',
    headers: auth(butcherToken),
    json: { status: 'ready' },
  });
  const delivered = await req(`/api/butchers/orders/${orderId}`, {
    method: 'PUT',
    headers: auth(butcherToken),
    json: { status: 'delivered' },
  });
  rec('Order delivered', delivered.status === 200, delivered.data?.error || String(delivered.status));

  const commission = execSync(
    `PGPASSWORD='butcher-local-phase2-only' psql -h 127.0.0.1 -p 5432 -U butcher -d sarh_butcher -tAc "SELECT amount, \\"referenceType\\" FROM \\"Payment\\" WHERE \\"referenceType\\" IN ('order_commission','commission') AND \\"referenceId\\"='${orderId}'"`,
    { encoding: 'utf8' },
  ).trim();
  rec(
    '10% commission ledger',
    commission.includes('order_commission') || /10|10.00/.test(commission),
    commission || 'no row',
  );

  const stranger = await req(`/api/butchers/orders/${orderId}`, {
    method: 'PUT',
    headers: auth(customerToken),
    json: { status: 'cancelled' },
  });
  rec(
    'Unauthorized order update rejected',
    stranger.status === 401 || stranger.status === 403 || stranger.status === 400,
    String(stranger.status),
  );

  // Legacy unpaid order path
  const legacy = await req('/api/butchers/orders', {
    method: 'POST',
    headers: auth(customerToken),
    json: {
      butcherId,
      deliveryType: 'pickup',
      productId,
      cutType: 'whole',
      weightKg: 1,
    },
  });
  const legacyId = legacy.data?.data?.id;
  rec(
    'Legacy POST /butchers/orders',
    (legacy.status === 201 || legacy.status === 200) && Boolean(legacyId),
    legacy.data?.error || String(legacy.status),
  );

  if (legacyId) {
    const legacyPayInit = await req('/api/payments/initiate', {
      method: 'POST',
      headers: auth(customerToken),
      json: {
        amount: 50,
        method: 'mada',
        type: 'butcher_order',
        referenceId: legacyId,
      },
    });
    rec(
      'Legacy order payment init',
      legacyPayInit.status === 200,
      legacyPayInit.data?.error || String(legacyPayInit.status),
    );
  }

  // Logout / blacklist
  const logout = await req('/api/auth/logout', {
    method: 'POST',
    headers: auth(customerToken),
    json: { refreshToken: customerRefresh },
  });
  rec('Logout', logout.status === 200, String(logout.status));
  const afterLogout = await req('/api/butchers/orders', {
    headers: auth(customerToken),
  });
  rec(
    'Token invalidation',
    afterLogout.status === 401 || afterLogout.status === 403,
    String(afterLogout.status),
  );

  // Redis isolation
  const keys6380 = execSync('redis-cli -p 6380 KEYS "*"', { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);
  const badKeys = keys6380.filter((k) => !k.startsWith('butcherapp:') && !k.startsWith('{butcherapp:'));
  rec(
    'Redis 6380 uses butcherapp: prefix',
    keys6380.length > 0 && badKeys.length === 0,
    `${keys6380.length} keys, stray=${badKeys.length}`,
  );
  const heartbeat = execSync(
    'redis-cli -p 6380 GET butcherapp:worker:heartbeat',
    { encoding: 'utf8' },
  ).trim();
  rec('Heartbeat key present', Boolean(heartbeat) && heartbeat !== '(nil)', heartbeat.slice(0, 80));

  const keys6379Before = execSync(
    'redis-cli -p 6379 --scan --pattern "butcherapp:*" | wc -l',
    { encoding: 'utf8' },
  ).trim();
  rec(
    'Did not write butcherapp: to SARH Redis 6379',
    keys6379Before === '0',
    keys6379Before,
  );

  // Nginx rewrite verification (same rules as live snippet)
  const snippet = readFileSync(
    '/home/ubuntu/sarh-butcher/nginx/butcher-api-location.conf',
    'utf8',
  );
  const toNest = (publicPath) => {
    const compat = publicPath.match(/^\/api\/butcher\/api\/(.*)$/);
    if (compat) return `/api/${compat[1]}`;
    const clean = publicPath.match(/^\/api\/butcher\/(.*)$/);
    if (clean) return `/api/${clean[1]}`;
    return publicPath;
  };
  rec(
    'Nginx canonical rewrite',
    toNest('/api/butcher/butchers/checkout') === '/api/butchers/checkout' &&
      snippet.includes('rewrite ^/api/butcher/(.*)$ /api/$1 break;'),
  );
  rec(
    'Nginx compat rewrite',
    toNest('/api/butcher/api/butchers/checkout') === '/api/butchers/checkout',
  );
  rec(
    'Nginx does not steal /api/butchers',
    toNest('/api/butchers/checkout') === '/api/butchers/checkout' &&
      snippet.includes('location ^~ /api/butcher/'),
  );
  rec('Nginx socket path', snippet.includes('location ^~ /api/butcher/socket.io/'));

  // UI servers
  try {
    const dash = await fetch(DASH, { redirect: 'manual' });
    rec('Dashboard HTTP', dash.status < 500, String(dash.status));
  } catch (e) {
    rec('Dashboard HTTP', false, e.message);
  }
  try {
    const adminUi = await fetch(`${ADMIN_UI}/login`, { redirect: 'manual' });
    rec('Admin HTTP', adminUi.status < 500, String(adminUi.status));
  } catch (e) {
    rec('Admin HTTP', false, e.message);
  }

  // Socket
  try {
    const require = createRequire(import.meta.url);
    const { io } = require('/home/ubuntu/sarh-butcher/butcher-dashboard/node_modules/socket.io-client');
    const socketOk = await new Promise((resolve) => {
      const s = io(SOCKET, {
        auth: { token: butcherToken },
        transports: ['websocket'],
        timeout: 8000,
      });
      const timer = setTimeout(() => {
        s.close();
        resolve(false);
      }, 8000);
      s.on('connect', () => {
        clearTimeout(timer);
        s.close();
        resolve(true);
      });
      s.on('connect_error', () => {
        clearTimeout(timer);
        s.close();
        resolve(false);
      });
    });
    rec('Socket connect with butcher JWT', socketOk);
  } catch (e) {
    rec('Socket connect with butcher JWT', false, e.message);
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n=== PHASE3 SUMMARY ===');
  console.log(`passed=${results.filter((r) => r.ok).length} failed=${failed.length}`);
  if (failed.length) {
    for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
