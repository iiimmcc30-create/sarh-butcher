import { readFileSync } from 'fs';
import { join } from 'path';

describe('malahem public root routing', () => {
  const root = join(__dirname, '../..');
  const sni = readFileSync(join(root, 'nginx/malahem-sni-locations.conf'), 'utf8');
  const ssl = readFileSync(join(root, 'nginx/hostinger-ssl.conf'), 'utf8');
  const vps = readFileSync(join(root, 'docker-compose.vps.yml'), 'utf8');

  it('sends / to customer web, not /butcher or /admin', () => {
    expect(sni).toContain('proxy_pass http://172.20.0.1:3104');
    expect(sni).not.toMatch(/location\s*=\s*\/\s*\{[\s\S]*?return\s+302\s+\/butcher/);
    expect(ssl).toContain('proxy_pass http://172.20.0.1:3104');
    expect(ssl).not.toMatch(/location\s*=\s*\/\s*\{[\s\S]*?return\s+302\s+\/butcher/);
  });

  it('keeps API, socket, admin, and butcher paths', () => {
    for (const conf of [sni, ssl]) {
      expect(conf).toContain('location /api/');
      expect(conf).toContain('location /socket.io/');
      expect(conf).toContain('location = /admin');
      expect(conf).toContain('location /admin/');
      expect(conf).toContain('location = /butcher');
      expect(conf).toContain('location /butcher/');
    }
  });

  it('publishes an independent web container on 3104', () => {
    expect(vps).toMatch(/^\s+web:/m);
    expect(vps).toContain('172.20.0.1:3104:80');
    expect(vps).toContain('image: sarh-butcher-web:latest');
    expect(vps).not.toContain('sarh-web:latest');
  });
});
