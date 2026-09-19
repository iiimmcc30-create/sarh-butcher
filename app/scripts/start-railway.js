/**
 * Dev against a remote Malahem API (no local backend required).
 * Usage: EXPO_PUBLIC_API_URL=https://… EXPO_PUBLIC_SOCKET_URL=https://… npm run start:railway
 */
const PRODUCTION_API = process.env.EXPO_PUBLIC_API_URL?.trim();
const PRODUCTION_SOCKET = process.env.EXPO_PUBLIC_SOCKET_URL?.trim();

if (!PRODUCTION_API || !PRODUCTION_SOCKET) {
  console.error(
    'Set EXPO_PUBLIC_API_URL and EXPO_PUBLIC_SOCKET_URL to the independent Malahem origins. No Sarh fallback.',
  );
  process.exit(1);
}

process.env.EXPO_PUBLIC_API_URL = PRODUCTION_API;
process.env.EXPO_PUBLIC_SOCKET_URL = PRODUCTION_SOCKET;
// Prevent web-only same-origin flag from leaking into native Metro bundles.
process.env.EXPO_PUBLIC_WEB_SAME_ORIGIN = 'false';

require('./start-qr');
