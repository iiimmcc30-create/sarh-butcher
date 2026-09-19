#!/usr/bin/env node
/**
 * Static production-configuration check. No secrets. No deploy.
 * SAFE TO RUN LOCALLY.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const failures = [];
const rec = (ok, name, detail = '') => {
  if (ok) console.log(`PASS  ${name}`);
  else {
    failures.push(name);
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const prod = read('docker-compose.prod.yml');
const vps = read('docker-compose.vps.yml');
const local = read('docker-compose.yml');
const payment = read('nginx/payment-bridge.conf');
const nginx = read('nginx/nginx.prod.conf');
const eas = read('app/eas.json');
const appJson = JSON.parse(read('app/app.json'));
const envProd = read('.env.production.example');

const stripComments = (text) => text.replace(/^\s*#.*$/gm, '');

rec(prod.includes('malahem_internal'), 'prod compose uses malahem_internal');
rec(vps.includes('malahem_internal'), 'vps compose uses malahem_internal');
rec(local.includes('malahem_internal'), 'local compose uses malahem_internal');
rec(!stripComments(prod).includes('sarh_internal'), 'prod compose has no sarh_internal network');
rec(!stripComments(vps).includes('sarh_internal'), 'vps compose has no sarh_internal network');
rec(payment.includes('api:3001'), 'payment-bridge → api:3001');
rec(!payment.includes('web:80'), 'payment-bridge does not use web:80');
rec(nginx.includes('payment-bridge.conf'), 'nginx.prod includes payment-bridge');
rec(!eas.includes('sarhsa.online'), 'eas.json has no sarhsa.online');
rec(appJson.expo?.slug === 'malahm', 'Expo slug is malahm');
rec(appJson.expo?.android?.package === 'com.sarh.butcher', 'Android package is com.sarh.butcher');
rec(appJson.expo?.scheme === 'malahm', 'scheme is malahm');
rec(
  appJson.expo?.extra?.eas?.projectId === '66fbef22-4a7b-45de-9280-c4dc8d7afb80',
  'EAS projectId unchanged',
);
rec(envProd.includes('<MALAHEM_PRODUCTION_DOMAIN>'), 'prod env example uses domain placeholder');
rec(envProd.includes('FIREBASE_PROJECT_ID='), 'prod env example has Firebase placeholders');
rec(envProd.includes('JWT_ISSUER=malahm-sarh'), 'prod env example issuer is malahm-sarh');
rec(envProd.includes('CLOUDINARY_FOLDER=sarh-butcher'), 'prod env example Cloudinary folder');
rec(envProd.includes('REDIS_KEY_PREFIX=butcherapp:'), 'prod env example Redis prefix');
rec(envProd.includes('SKIP_MIGRATIONS=true'), 'prod env example skips auto-migrate');
rec(prod.includes("SKIP_MIGRATIONS: ${SKIP_MIGRATIONS:-true}"), 'prod compose defaults SKIP_MIGRATIONS=true');
rec(read('backend-nest/scripts/docker-entrypoint.sh').includes('RUN_MIGRATIONS'), 'entrypoint requires RUN_MIGRATIONS in production');
rec(read('scripts/migrate-from-sarh.mjs').includes('NOT PART OF PRODUCTION LAUNCH'), 'migration script marked historical');
rec(read('docs/MALAHEM_PRODUCTION_DEPLOYMENT_RUNBOOK.md').includes('SARH DATA MIGRATION: NOT REQUIRED'), 'deploy runbook has no Sarh migration step');

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('\nStatic production configuration checks passed.');
