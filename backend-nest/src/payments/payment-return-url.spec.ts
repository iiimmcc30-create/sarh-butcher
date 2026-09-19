import { readFileSync } from 'fs';
import { join } from 'path';

describe('payment return URL contract', () => {
  const service = readFileSync(join(__dirname, 'payments.service.ts'), 'utf8');
  const main = readFileSync(join(__dirname, '../main.ts'), 'utf8');

  it('sends N-Genius to APP_URL/payment/result (no /api prefix)', () => {
    expect(service).toMatch(
      /redirectUrl = `\$\{appUrl\}\/payment\/result\?paymentId=/,
    );
    expect(service).not.toMatch(/\$\{appUrl\}\/api\/payment\/result/);
    expect(service).toMatch(/\$\{appUrl\}\/payment\/cancel/);
  });

  it('excludes the bridge pages from the Nest /api global prefix', () => {
    expect(main).toContain("path: 'payment/result'");
    expect(main).toContain("path: 'payment/cancel'");
    expect(main).toContain("app.setGlobalPrefix('api'");
  });

  it('documents that GET /api/payment/result is not the production callback', () => {
    // Previous audit hit 404 on /api/payment/result — that path is unused.
    // The live callback is GET /payment/result (see PaymentRedirectController + prefix exclude).
    expect(main).toMatch(/without the \/api prefix/);
  });
});
