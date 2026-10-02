import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'production_ready_asset_management_jwt_secret_key_2026_x7912'
);

export const AUTH_COOKIE_NAME = 'assetflow_auth_token';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  name: string;
  fullName: string;
  role: 'super_admin' | 'admin' | 'employee';
  designation?: string | null;
  employee_id?: string | null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signAuthToken(user: AuthUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name || user.fullName,
    fullName: user.fullName || user.name,
    role: user.role,
    designation: user.designation || null,
    employee_id: user.employee_id || null,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifyAuthToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const role = (payload.role === 'it_admin' ? 'admin' : payload.role) as AuthUser['role'];
    const name = (payload.name as string) || (payload.fullName as string) || 'User';
    return {
      id: payload.id as number,
      username: payload.username as string,
      email: payload.email as string,
      name,
      fullName: name,
      role,
      designation: (payload.designation as string) || null,
      employee_id: (payload.employee_id as string) || null,
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifyAuthToken(token);
  } catch {
    return null;
  }
}

export function extractTokenFromRequest(req: NextRequest): string | null {
  const cookieToken = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

export async function getAuthUserFromRequest(req: NextRequest): Promise<AuthUser | null> {
  const token = extractTokenFromRequest(req);
  if (!token) return null;
  return await verifyAuthToken(token);
}
