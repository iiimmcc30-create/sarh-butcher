import { readFileSync } from 'fs';
import { join } from 'path';

describe('independent butcher API nginx path', () => {
  const snippet = readFileSync(
    join(__dirname, '../../../nginx/butcher-api-location.conf'),
    'utf8',
  );
  const ssl = readFileSync(
    join(__dirname, '../../../nginx/nginx.ssl.server.conf'),
    'utf8',
  );
  const prod = readFileSync(
    join(__dirname, '../../../nginx/nginx.prod.conf'),
    'utf8',
  );

  it('routes /api/butcher/ to the butcher upstream, not SARH /api/', () => {
    expect(snippet).toContain('location ^~ /api/butcher/');
    expect(snippet).toContain('rewrite ^/api/butcher/(.*)$ /$1 break;');
    expect(snippet).toContain('set $butcher_api_upstream api:3001');
    expect(snippet).not.toContain('sarouh_api');
  });

  it('does not steal SARH /api/butchers or /api/butcher-applications', () => {
    expect(snippet).toContain('location ^~ /api/butcher/');
    expect(snippet).not.toMatch(/location\s+\^~\s+\/api\/butcher[^-/]/);
    expect(snippet).toContain('location = /api/butcher');
  });

  it('keeps socket traffic on an isolated path', () => {
    expect(snippet).toContain('location ^~ /api/butcher/socket.io/');
    expect(snippet).toContain('set $butcher_socket_upstream socket:3002');
  });

  it('is included before leftover /api/ blocks', () => {
    expect(ssl).toContain('butcher-api-location.conf');
    expect(ssl.indexOf('butcher-api-location.conf')).toBeLessThan(
      ssl.indexOf('location /api/'),
    );
    expect(prod).toContain('butcher-api-location.conf');
  });
});
