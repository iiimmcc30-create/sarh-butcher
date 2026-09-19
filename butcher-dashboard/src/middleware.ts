import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyButcherAccessToken } from '@/lib/butcher-jwt';
import { withButcherBase } from '@/constants/butcherBasePath';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rawToken = request.cookies.get('butcher_token')?.value;
  const token = rawToken ? decodeURIComponent(rawToken) : undefined;
  // With next.config basePath, middleware pathname is unprefixed (e.g. `/login`).
  const isLogin = pathname === '/login' || pathname.startsWith('/login/');

  // Login page validates/restores sessions client-side; stale cookies must not
  // bounce users away before the page can clear or refresh them.
  if (isLogin) {
    return NextResponse.next();
  }

  const secret =
    process.env.BUTCHER_JWT_SECRET?.trim() || process.env.JWT_SECRET?.trim();
  const verified = await verifyButcherAccessToken(token, secret);
  if (!verified.ok) {
    // Do not use `new URL('/login', request.url)` — that ignores basePath and
    // sends browsers to https://host/login (Expo unmatched), not /butcher/login.
    // reason=session stops login-page restore from bouncing back here.
    const login = new URL(withButcherBase('/login'), request.url);
    login.searchParams.set('reason', 'session');
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
