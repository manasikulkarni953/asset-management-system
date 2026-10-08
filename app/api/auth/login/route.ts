import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { signAuthToken, AUTH_COOKIE_NAME } from '@/lib/auth';
import { checkRateLimit, resetRateLimit, getClientIp } from '@/lib/rate-limiter';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateLimitKey = `login_${ip}`;
    const rateLimit = checkRateLimit(rateLimitKey, 10, 15 * 60 * 1000);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many login attempts. Please try again in ${rateLimit.resetSeconds} seconds.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.resetSeconds),
            'X-RateLimit-Limit': String(rateLimit.totalLimit),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request payload.' },
        { status: 400 }
      );
    }

    const identifier = (body.identifier || body.email || body.username || '').toString().trim();
    const password = body.password;

    if (!identifier || !password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Username/Email and Password are required.' },
        { status: 400 }
      );
    }

    const cleanIdentifier = identifier.trim();

    // Ensure default admin exists if first run
    try {
      await AuthService.ensureDefaultAdmin();
    } catch (e: any) {
      console.warn('[LOGIN_API] DB check during admin ensure encountered warning:', e?.message);
    }

    let user;
    try {
      user = await AuthService.login(cleanIdentifier, password);
    } catch (dbError: any) {
      console.error('[LOGIN_API] Database query/connection error during authentication:', {
        code: dbError?.code,
        errno: dbError?.errno,
        sqlState: dbError?.sqlState,
        message: dbError?.message,
      });

      return NextResponse.json(
        { error: 'Authentication service temporarily unavailable. Please try again shortly.' },
        { status: 503 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid username/email or password.' },
        {
          status: 401,
          headers: {
            'X-RateLimit-Limit': String(rateLimit.totalLimit),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
          },
        }
      );
    }

    // Clear rate limit on successful authentication
    resetRateLimit(rateLimitKey);

    const token = await signAuthToken(user);

    const response = NextResponse.json({
      success: true,
      user,
      message: 'Login successful',
    });

    const isHttps = req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error('[LOGIN_API] Unexpected error in login route:', {
      name: error?.name,
      message: error?.message,
    });
    return NextResponse.json(
      { error: 'Authentication service encountered an unexpected error.' },
      { status: 500 }
    );
  }
}
