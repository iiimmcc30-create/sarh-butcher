import { readFileSync } from 'fs';
import { join } from 'path';

describe('API docker entrypoint migrations', () => {
  const sh = readFileSync(
    join(__dirname, '../../scripts/docker-entrypoint.sh'),
    'utf8',
  );

  it('does not migrate on production restarts unless RUN_MIGRATIONS=true', () => {
    expect(sh).toContain('RUN_MIGRATIONS');
    expect(sh).toContain('NODE_ENV=production — skipping migrate deploy');
    expect(sh).toContain('SKIP_MIGRATIONS');
  });

  it('still allows an explicit one-shot migrate deploy', () => {
    expect(sh).toContain('npx prisma migrate deploy');
    expect(sh).toContain('should_migrate');
  });
});
