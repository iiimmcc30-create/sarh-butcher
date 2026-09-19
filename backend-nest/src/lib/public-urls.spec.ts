import { publicApiBase, publicApiPath, publicSiteUrl } from './public-urls';

describe('public butcher URLs', () => {
  it('keeps local API and site on localhost when PUBLIC_API_URL is unset', () => {
    const env = { APP_URL: 'http://localhost:3001' };
    expect(publicSiteUrl(env)).toBe('http://localhost:3001');
    expect(publicApiBase(env)).toBe('http://localhost:3001');
    expect(publicApiPath('/api/admin/cleanup', env)).toBe(
      'http://localhost:3001/api/admin/cleanup',
    );
  });

  it('uses the independent /api/butcher prefix without falling back to SARH /api', () => {
    const env = {
      APP_URL: 'https://sarhsa.online',
      PUBLIC_API_URL: 'https://sarhsa.online/api/butcher',
    };
    expect(publicSiteUrl(env)).toBe('https://sarhsa.online');
    expect(publicApiBase(env)).toBe('https://sarhsa.online/api/butcher');
    expect(publicApiPath('/api/butchers/checkout', env)).toBe(
      'https://sarhsa.online/api/butcher/api/butchers/checkout',
    );
    expect(publicApiPath('/api/admin/cleanup', env)).not.toBe(
      'https://sarhsa.online/api/admin/cleanup',
    );
  });
});
