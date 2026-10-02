import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'production_ready_asset_management_jwt_secret_key_2026_x7912'
);

const AUTH_COOKIE_NAME = 'assetflow_auth_token';

const PROTECTED_ROUTES = [
  '/dashboard',
  '/assets',
  '/employees',
  '/assignments',
  '/scan',
  '/tickets',
  '/insurance',
  '/network',
  '/reports',
];

const PUBLIC_API_PREFIXES = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/health/db',
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Extract auth token from cookie or Authorization header
  let token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  let isAuthenticated = false;
  let userRole = 'employee';
  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      isAuthenticated = true;
      userRole = (payload.role === 'it_admin' ? 'admin' : payload.role) as string;
    } catch {
      isAuthenticated = false;
    }
  }

  // Handle API route protection
  if (pathname.startsWith('/api/')) {
    const isPublicApi = PUBLIC_API_PREFIXES.some(
      (pub) => pathname === pub || pathname.startsWith(`${pub}/`)
    );

    if (!isPublicApi && !isAuthenticated) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: Authentication token is missing, expired, or invalid.',
        },
        { status: 401 }
      );
    }

    return NextResponse.next();
  }

  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  ) || pathname.startsWith('/admin/');

  // Redirect to dashboard if logged in and visiting login
  if (pathname === '/login' || pathname === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if (pathname === '/') {
      const loginUrl = new URL('/login', request.url);
      loginUrl.search = '';
      return NextResponse.redirect(loginUrl);
    }
  }

  // Intercept unauthenticated access to protected routes
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.search = '';
    const fullRedirect = request.nextUrl.search ? `${pathname}${request.nextUrl.search}` : pathname;
    loginUrl.searchParams.set('redirect', fullRedirect);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based route guard enforcement for page routes
  if (isAuthenticated) {
    // 1. Super Admin only routes: /admin/users, /admin/it-specialists
    if (pathname.startsWith('/admin/')) {
      if (userRole !== 'super_admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    // 2. Admin & Super Admin only routes: /assignments, /reports, /insurance, /network
    const adminOnlyRoutes = ['/assignments', '/reports', '/insurance', '/network'];
    const isAdminOnlyRoute = adminOnlyRoutes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );
    if (isAdminOnlyRoute && userRole === 'employee') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

// Next.js standard export
export default proxy;

export const config = {
  matcher: [
    '/',
    '/login',
    '/admin/:path*',
    '/dashboard/:path*',
    '/assets/:path*',
    '/employees/:path*',
    '/assignments/:path*',
    '/scan/:path*',
    '/tickets/:path*',
    '/insurance/:path*',
    '/network/:path*',
    '/reports/:path*',
    '/api/:path*',
  ],
};
