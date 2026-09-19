/**
 * Public URLs for ملاحم سرح.
 * APP_URL / MALAHEM_APP_URL = site origin (payment return pages).
 * PUBLIC_API_URL / MALAHEM_API_URL = independent API origin.
 * If that origin still ends with /api/butcher, path-prefix compat is applied.
 */
export function publicSiteUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (env.APP_URL || 'http://localhost:3001').replace(/\/$/, '');
}

export function publicApiBase(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const explicit = env.PUBLIC_API_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  return publicSiteUrl(env);
}

export function publicApiPath(
  path: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  let prefix = path.startsWith('/') ? path : `/${path}`;
  const base = publicApiBase(env);
  if (base.endsWith('/api/butcher') && prefix.startsWith('/api/')) {
    prefix = prefix.slice(4);
  }
  return `${base}${prefix}`;
}
