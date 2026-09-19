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

  it('maps the clean public namespace onto Nest /api without changing controllers', () => {
    expect(snippet).toContain('location ^~ /api/butcher/');
    expect(snippet).toContain('rewrite ^/api/butcher/api/(.*)$ /api/$1 break;');
    expect(snippet).toContain('rewrite ^/api/butcher/(.*)$ /api/$1 break;');
    expect(snippet).toContain('set $butcher_api_upstream api:3001');
    expect(snippet).not.toContain('sarouh_api');
  });

  it('rewrites both clean and compat public URLs to the same Nest path', () => {
    const compat = /^\/api\/butcher\/api\/(.*)$/;
    const clean = /^\/api\/butcher\/(.*)$/;
    const toNest = (publicPath: string) => {
      const compatMatch = publicPath.match(compat);
      if (compatMatch) return `/api/${compatMatch[1]}`;
      const cleanMatch = publicPath.match(clean);
      if (cleanMatch) return `/api/${cleanMatch[1]}`;
      return publicPath;
    };
    expect(toNest('/api/butcher/butchers/checkout')).toBe('/api/butchers/checkout');
    expect(toNest('/api/butcher/api/butchers/checkout')).toBe('/api/butchers/checkout');
    expect(toNest('/api/butcher/butcher-applications/join')).toBe(
      '/api/butcher-applications/join',
    );
    expect(toNest('/api/butchers/checkout')).toBe('/api/butchers/checkout');
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
