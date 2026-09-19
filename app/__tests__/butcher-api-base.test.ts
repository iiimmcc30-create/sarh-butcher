import { readFileSync } from 'fs';
import path from 'path';

function src(rel: string): string {
  return readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

describe('independent butcher API base', () => {
  it('does not use https://sarhsa.online/api as the generic mobile base', () => {
    const devHost = src('services/devHost.ts');
    const eas = src('eas.json');
    expect(devHost).not.toMatch(/sarhsa\.online\/api['"`]/);
    expect(eas).not.toContain('https://sarhsa.online/api"');
    expect(eas).toContain('https://sarhsa.online/api/butcher');
    expect(eas).toContain('/api/butcher/socket.io');
  });

  it('keeps local development on isolated ports', () => {
    const eas = src('eas.json');
    expect(eas).toContain('http://localhost:3001');
    expect(eas).toContain('http://localhost:3002');
  });

  it('isolates production sockets from SARH /socket.io', () => {
    const socket = src('lib/socket.ts');
    expect(socket).toContain('/api/butcher/socket.io');
    expect(socket).toContain('path: resolveSocketPath()');
  });
});
