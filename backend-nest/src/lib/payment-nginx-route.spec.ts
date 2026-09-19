import { readFileSync } from 'fs';
import { join } from 'path';

describe('nginx payment callback routing', () => {
  const root = join(__dirname, '../../..');
  const paymentBridge = readFileSync(
    join(root, 'nginx/payment-bridge.conf'),
    'utf8',
  );
  const prodCompose = readFileSync(join(root, 'docker-compose.prod.yml'), 'utf8');
  const vpsCompose = readFileSync(join(root, 'docker-compose.vps.yml'), 'utf8');
  const prodNginx = readFileSync(join(root, 'nginx/nginx.prod.conf'), 'utf8');

  it('sends /payment/result and /payment/cancel to the Malahem API', () => {
    expect(paymentBridge).toContain('location = /payment/result');
    expect(paymentBridge).toContain('location = /payment/cancel');
    expect(paymentBridge).toContain('set $api_upstream api:3001');
    expect(paymentBridge).not.toMatch(/web:80/);
    expect(prodNginx).toContain('payment-bridge.conf');
  });

  it('resolves api:3001 on the independent Malahem compose network', () => {
    const prodCode = prodCompose.replace(/^\s*#.*$/gm, '');
    const vpsCode = vpsCompose.replace(/^\s*#.*$/gm, '');
    expect(prodCompose).toMatch(/^\s+api:/m);
    expect(prodCompose).toContain('aliases: [api, butcher-api]');
    expect(prodCompose).toContain('malahem_internal');
    expect(prodCode).not.toContain('sarh_internal');
    expect(vpsCompose).toContain('aliases: [api, butcher-api]');
    expect(vpsCompose).toContain('malahem_internal');
    expect(vpsCode).not.toContain('sarh_internal');
  });
});
