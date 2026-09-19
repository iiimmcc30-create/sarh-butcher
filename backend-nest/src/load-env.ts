import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '../.env') });

/** Independent names alias onto the existing runtime keys. Never read SARH .env. */
function alias(from: string, to: string) {
  if (!process.env[to]?.trim() && process.env[from]?.trim()) {
    process.env[to] = process.env[from];
  }
}

alias('MALAHEM_DATABASE_URL', 'DATABASE_URL');
alias('BUTCHER_DATABASE_URL', 'DATABASE_URL');
alias('MALAHEM_DIRECT_URL', 'DIRECT_URL');
alias('BUTCHER_JWT_SECRET', 'JWT_SECRET');
alias('BUTCHER_JWT_REFRESH_SECRET', 'JWT_REFRESH_SECRET');
alias('MALAHEM_REDIS_URL', 'REDIS_URL');
alias('MALAHEM_NI_API_KEY', 'NI_API_KEY');
alias('MALAHEM_NI_OUTLET_ID', 'NI_OUTLET_ID');
alias('MALAHEM_NI_WEBHOOK_SECRET', 'NI_WEBHOOK_SECRET');
alias('MALAHEM_NI_BASE_URL', 'NI_BASE_URL');
alias('MALAHEM_API_URL', 'PUBLIC_API_URL');
alias('MALAHEM_APP_URL', 'APP_URL');
alias('MALAHEM_DASHBOARD_URL', 'BUTCHER_DASHBOARD_URL');

if (!process.env.DIRECT_URL?.trim() && process.env.DATABASE_URL?.trim()) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}
