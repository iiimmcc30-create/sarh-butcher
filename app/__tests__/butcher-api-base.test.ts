import { readFileSync } from 'fs';
import path from 'path';

function src(rel: string): string {
  return readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

describe('independent butcher API base', () => {
  it('does not bake sarhsa.online or generic Sarh /api into mobile config', () => {
    const devHost = src('services/devHost.ts');
    const eas = src('eas.json');
    expect(devHost).not.toMatch(/sarhsa\.online/);
    expect(devHost).not.toMatch(/sarhsa\.online\/api['"`]/);
    expect(eas).not.toContain('https://sarhsa.online');
    expect(eas).toContain('https://malahem.sarhsa.online');
    expect(eas).not.toContain('/api/butcher');
    expect(eas).toContain('/socket.io');
  });

  it('keeps local development on isolated ports', () => {
    const eas = src('eas.json');
    expect(eas).toContain('http://localhost:3001');
    expect(eas).toContain('http://localhost:3002');
  });

  it('defaults sockets to /socket.io and only uses /api/butcher as path-prefix compat', () => {
    const socket = src('lib/socket.ts');
    expect(socket).toContain("return '/api/butcher/socket.io'");
    expect(socket).toContain("PRODUCTION_SOCKET_PATH || '/socket.io'");
    expect(socket).toContain('path: resolveSocketPath()');
  });
});
