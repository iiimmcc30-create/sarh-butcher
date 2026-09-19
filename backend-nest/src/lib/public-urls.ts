/**
 * Public URLs for ملاحم سرح.
 * APP_URL = site origin (payment return pages). Never a SARH API fallback.
 * PUBLIC_API_URL = independent API prefix on the shared host.
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
  const prefix = path.startsWith('/') ? path : `/${path}`;
  return `${publicApiBase(env)}${prefix}`;
}
