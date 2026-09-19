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

  it('uses a dedicated Malahem API origin without a path prefix', () => {
    const env = {
      APP_URL: 'https://app.malahem.example',
      PUBLIC_API_URL: 'https://api.malahem.example',
    };
    expect(publicSiteUrl(env)).toBe('https://app.malahem.example');
    expect(publicApiBase(env)).toBe('https://api.malahem.example');
    expect(publicApiPath('/api/butchers/checkout', env)).toBe(
      'https://api.malahem.example/api/butchers/checkout',
    );
  });

  it('keeps optional /api/butcher path-prefix compatibility', () => {
    const env = {
      APP_URL: 'https://app.malahem.example',
      PUBLIC_API_URL: 'https://api.malahem.example/api/butcher',
    };
    expect(publicApiBase(env)).toBe('https://api.malahem.example/api/butcher');
    expect(publicApiPath('/api/butchers/checkout', env)).toBe(
      'https://api.malahem.example/api/butcher/butchers/checkout',
    );
    expect(publicApiPath('/api/admin/cleanup', env)).not.toBe(
      'https://app.malahem.example/api/admin/cleanup',
    );
  });
});
