import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { isTokenRevoked, hashToken } from './token-revocation';

// In ALL environments, secrets MUST be set. No fallbacks.
if (!process.env.JWT_SECRET || !process.env.REFRESH_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET and REFRESH_SECRET environment variables are required in production');
  }
  // Development only: auto-generate ephemeral secrets for this session
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = crypto.randomBytes(64).toString('hex');
    console.warn('[DEV] JWT_SECRET not set — auto-generated ephemeral secret for this session. Tokens will NOT survive restart.');
  }
  if (!process.env.REFRESH_SECRET) {
    process.env.REFRESH_SECRET = crypto.randomBytes(64).toString('hex');
    console.warn('[DEV] REFRESH_SECRET not set — auto-generated ephemeral secret for this session. Tokens will NOT survive restart.');
  }
}

const JWT_SECRET = process.env.JWT_SECRET!;
const REFRESH_SECRET = process.env.REFRESH_SECRET!;
export { JWT_SECRET, REFRESH_SECRET };

interface TokenPayload {
  role?: string;
  email?: string;
  id?: number;
  salonId?: number;
  customerPhone?: string;
  type?: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, REFRESH_SECRET) as TokenPayload;
  } catch (err) {
    console.warn('[Auth] Refresh token verification failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (err) {
    console.warn('[Auth] Token verification failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export function getTokenHash(token: string): string {
  return hashToken(token);
}

export async function verifyRefreshTokenSecure(token: string): Promise<TokenPayload | null> {
  try {
    const decoded = jwt.verify(token, REFRESH_SECRET) as TokenPayload;
    const tokenHash = hashToken(token);
    const revoked = await isTokenRevoked(tokenHash);
    if (revoked) {
      console.warn('[Auth] Refresh token has been revoked');
      return null;
    }
    return decoded;
  } catch (err) {
    console.warn('[Auth] Refresh token verification failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
