import { readFileSync } from 'fs';
import { join } from 'path';

describe('join nginx route', () => {
  it('inlines /join on the API like /privacy (not Expo web)', () => {
    const prod = readFileSync(
      join(__dirname, '../../../../nginx/nginx.prod.conf'),
      'utf8',
    );
    expect(prod).toContain('location = /join');
    expect(prod).toContain('location = /join/success');
    expect(prod).toContain('location /privacy');
  });
});
