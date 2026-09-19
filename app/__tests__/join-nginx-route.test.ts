import { readFileSync } from 'fs';
import { join } from 'path';

describe('join public route', () => {
  it('does not fall through Expo unmatched on web nginx', () => {
    const web = readFileSync(join(__dirname, '../nginx.web.conf'), 'utf8');
    expect(web).toContain('location = /join');
    expect(web).toContain('proxy_pass http://api:3001');
    const idxJoin = web.indexOf('location = /join');
    const idxRoot = web.indexOf('location / {');
    expect(idxJoin).toBeGreaterThan(-1);
    expect(idxJoin).toBeLessThan(idxRoot);
  });
});
