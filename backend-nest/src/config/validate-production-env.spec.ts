import { validateProductionEnv } from './validate-production-env';

function fillCompleteProductionEnv(): void {
  process.env.NODE_ENV = 'production';
  process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
  process.env.JWT_SECRET = 'x'.repeat(32);
  process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
  process.env.TWILIO_ACCOUNT_SID = 'ACrealaccountsid012345678901234567';
  process.env.TWILIO_AUTH_TOKEN = 'token';
  process.env.TWILIO_VERIFY_SERVICE_SID = 'VA123';
  process.env.NI_BASE_URL = 'https://api-gateway.ksa.ngenius-payments.com';
  process.env.NI_OUTLET_ID = 'a13f81f3-27b4-48b6-88de-22b9ddc1e1dc';
  process.env.NI_API_KEY = 'live_real_key_not_test';
  process.env.NI_WEBHOOK_SECRET = 'whsec';
  process.env.STORAGE_PROVIDER = 'cloudinary';
  process.env.CLOUDINARY_CLOUD_NAME = 'c';
  process.env.CLOUDINARY_API_KEY = 'k';
  process.env.CLOUDINARY_API_SECRET = 's';
  process.env.REDIS_HOST = 'redis';
  process.env.APP_URL = 'https://app.malahem.example';
  process.env.PUBLIC_API_URL = 'https://api.malahem.example';
  process.env.ALLOWED_ORIGINS =
    'https://dashboard.malahem.example,https://admin.malahem.example';
  process.env.CRON_SECRET = 'cron-secret-value';
  process.env.JWT_ISSUER = 'malahm-sarh';
  process.env.SECRETS_ENCRYPTION_KEY = 'z'.repeat(32);
  delete process.env.DEV_OTP;
}

describe('validateProductionEnv', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('is a no-op outside production', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.DATABASE_URL;
    expect(() => validateProductionEnv()).not.toThrow();
  });

  it('aborts production when critical vars are missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_URL;
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_VERIFY_SERVICE_SID;
    delete process.env.NI_BASE_URL;
    delete process.env.NI_OUTLET_ID;
    delete process.env.NI_API_KEY;
    delete process.env.NI_WEBHOOK_SECRET;
    delete process.env.STORAGE_PROVIDER;
    delete process.env.REDIS_HOST;
    delete process.env.APP_URL;
    delete process.env.PUBLIC_API_URL;
    delete process.env.MALAHEM_API_URL;
    delete process.env.ALLOWED_ORIGINS;
    process.env.REDIS_ENABLED = 'true';

    expect(() => validateProductionEnv()).toThrow(
      /Application startup validation failed/,
    );
    expect(() => validateProductionEnv()).toThrow(/DATABASE_URL/);
    expect(() => validateProductionEnv()).toThrow(/ALLOWED_ORIGINS/);
    expect(() => validateProductionEnv()).toThrow(
      /PUBLIC_API_URL or MALAHEM_API_URL/,
    );
    expect(() => validateProductionEnv()).toThrow(
      /Application startup aborted/,
    );
  });

  it('rejects DEV_OTP and mock NI keys in production', () => {
    fillCompleteProductionEnv();
    process.env.NI_API_KEY = 'test_key';
    process.env.DEV_OTP = 'true';

    expect(() => validateProductionEnv()).toThrow(/DEV_OTP/);
    expect(() => validateProductionEnv()).toThrow(/NI_API_KEY/);
  });

  it('passes when production env is complete', () => {
    fillCompleteProductionEnv();
    expect(() => validateProductionEnv()).not.toThrow();
  });

  it('accepts REDIS_URL without REDIS_HOST', () => {
    fillCompleteProductionEnv();
    delete process.env.REDIS_HOST;
    process.env.REDIS_URL = 'redis://red-xxxx:6379';

    expect(() => validateProductionEnv()).not.toThrow();
  });

  it('rejects loopback Redis 6379 in production', () => {
    fillCompleteProductionEnv();
    delete process.env.REDIS_HOST;
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';

    expect(() => validateProductionEnv()).toThrow(/6379|Sarh|MALAHEM_REDIS/);
  });

  it('accepts AWS_BUCKET_NAME as an alias of AWS_S3_BUCKET', () => {
    fillCompleteProductionEnv();
    process.env.STORAGE_PROVIDER = 's3';
    process.env.AWS_ACCESS_KEY_ID = 'ak';
    process.env.AWS_SECRET_ACCESS_KEY = 'sk';
    process.env.AWS_BUCKET_NAME = 'malahem-media';
    delete process.env.AWS_S3_BUCKET;
    delete process.env.REDIS_HOST;
    process.env.REDIS_URL = 'redis://butcher-redis:6379';

    expect(() => validateProductionEnv()).not.toThrow();
  });

  it('rejects Railway APP_URL in production', () => {
    fillCompleteProductionEnv();
    process.env.APP_URL = 'https://sarh-app.up.railway.app';

    expect(() => validateProductionEnv()).toThrow(/APP_URL/);
  });

  it('rejects Render APP_URL in production', () => {
    fillCompleteProductionEnv();
    process.env.APP_URL = 'https://sarh-api.onrender.com';

    expect(() => validateProductionEnv()).toThrow(/APP_URL/);
  });

  it('rejects sarhsa.online APP_URL in production', () => {
    fillCompleteProductionEnv();
    process.env.APP_URL = 'https://sarhsa.online';

    expect(() => validateProductionEnv()).toThrow(/sarhsa\.online/);
  });

  it('accepts malahem.sarhsa.online as the independent production origin', () => {
    fillCompleteProductionEnv();
    process.env.APP_URL = 'https://malahem.sarhsa.online';
    process.env.PUBLIC_API_URL = 'https://malahem.sarhsa.online';
    process.env.ALLOWED_ORIGINS = 'https://malahem.sarhsa.online';

    expect(() => validateProductionEnv()).not.toThrow();
  });

  it('rejects wildcard ALLOWED_ORIGINS', () => {
    fillCompleteProductionEnv();
    process.env.ALLOWED_ORIGINS = '*';

    expect(() => validateProductionEnv()).toThrow(/ALLOWED_ORIGINS/);
  });

  it('requires CRON_SECRET in production', () => {
    fillCompleteProductionEnv();
    delete process.env.CRON_SECRET;

    expect(() => validateProductionEnv()).toThrow(/CRON_SECRET/);
  });

  it('rejects a non-Malahem JWT issuer', () => {
    fillCompleteProductionEnv();
    process.env.JWT_ISSUER = 'sarh';

    expect(() => validateProductionEnv()).toThrow(/JWT_ISSUER/);
  });

  it('rejects localhost ALLOWED_ORIGINS in production', () => {
    fillCompleteProductionEnv();
    process.env.ALLOWED_ORIGINS = 'http://localhost:3003';

    expect(() => validateProductionEnv()).toThrow(/localhost/);
  });

  it('rejects malformed ALLOWED_ORIGINS', () => {
    fillCompleteProductionEnv();
    process.env.ALLOWED_ORIGINS = 'not-a-url';

    expect(() => validateProductionEnv()).toThrow(/malformed origin/);
  });

  it('rejects a Sarh Cloudinary folder', () => {
    fillCompleteProductionEnv();
    process.env.CLOUDINARY_FOLDER = 'safat';

    expect(() => validateProductionEnv()).toThrow(/CLOUDINARY_FOLDER/);
  });
});
