import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from './db';
import { JWT_SECRET } from './auth-helper';

const WRITE_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

export interface AdminRequest extends Request {
  isAdmin?: boolean;
  adminRole?: string;
  adminId?: number;
}

export interface SalonRequest extends Request {
  salonId?: number;
  salonEmail?: string;
}

export interface CustomerRequest extends Request {
  customerPhone?: string;
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.split(' ')[1];
}

function parseId(value: string): number | null {
  const id = parseInt(value, 10);
  if (isNaN(id) || id <= 0 || !Number.isInteger(id)) return null;
  return id;
}

// ─── Admin Auth (checks is_active in DB) ───────────────────────────
export async function adminAuth(req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { role: string; id: number };
    const allowedRoles = ['super_admin', 'admin', 'support', 'viewer'];
    if (!allowedRoles.includes(decoded.role)) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }
    const rows = await query('SELECT is_active FROM admins WHERE id = ?', [decoded.id]) as any[];
    if (rows.length === 0 || !rows[0].is_active) {
      res.status(403).json({ error: 'Account is disabled' });
      return;
    }
    if (decoded.role === 'viewer' && WRITE_METHODS.has(req.method)) {
      res.status(403).json({ error: 'Viewer role cannot perform write operations' });
      return;
    }
    req.isAdmin = true;
    req.adminRole = decoded.role;
    req.adminId = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── Super Admin Auth (checks is_active in DB) ─────────────────────
export async function superAdminAuth(req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { role: string; id: number };
    if (decoded.role !== 'super_admin') {
      res.status(403).json({ error: 'Only super admin allowed' });
      return;
    }
    const rows = await query('SELECT is_active FROM admins WHERE id = ?', [decoded.id]) as any[];
    if (rows.length === 0 || !rows[0].is_active) {
      res.status(403).json({ error: 'Account is disabled' });
      return;
    }
    req.isAdmin = true;
    req.adminRole = decoded.role;
    req.adminId = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── Salon Auth (checks salon status) ──────────────────────────────
export async function salonAuth(req: SalonRequest, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { salonId: number; email: string };
    if (!decoded.salonId) {
      res.status(401).json({ error: 'Invalid token: no salon ID' });
      return;
    }
    req.salonId = decoded.salonId;
    req.salonEmail = decoded.email;
    const rows = await query('SELECT id, status FROM salons WHERE id = ?', [decoded.salonId]) as any[];
    if (rows.length === 0 || rows[0].status !== 'active') {
      res.status(403).json({ error: 'Salon not found or inactive' });
      return;
    }
    next();
  } catch (e: any) {
    if (e?.name === 'JsonWebTokenError' || e?.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    console.error('[Auth Middleware Error]', e?.message || e);
    res.status(500).json({ error: 'Auth verification failed' });
  }
}

// ─── Customer Auth ─────────────────────────────────────────────────
export function customerAuth(req: CustomerRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { customerPhone: string; type: string };
    if (decoded.type !== 'customer') {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }
    req.customerPhone = decoded.customerPhone;
    next();
  } catch (err) {
    console.warn('[Customer Auth] Token verification failed:', err instanceof Error ? err.message : err);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── Helpers ───────────────────────────────────────────────────────
export { parseId };

export async function checkSalonAccess(req: AdminRequest, res: Response, salonId: number): Promise<boolean> {
  if (!salonId || isNaN(salonId)) {
    res.status(400).json({ error: 'Invalid salon ID' });
    return false;
  }
  if (req.adminRole === 'super_admin') return true;
  const allowedRoles = ['admin', 'super_admin', 'support'];
  if (!allowedRoles.includes(req.adminRole || '')) {
    res.status(403).json({ error: 'Not authorized for this salon' });
    return false;
  }
  const rows = await query('SELECT id FROM salons WHERE id = ? AND assigned_admin_id = ?', [salonId, req.adminId]) as any[];
  if (rows.length === 0) {
    res.status(403).json({ error: 'Not authorized for this salon' });
    return false;
  }
  return true;
}

export function requireWriteAccess(req: AdminRequest, res: Response, next: NextFunction): void {
  if (req.adminRole === 'viewer') {
    res.status(403).json({ error: 'Viewer role cannot perform write operations' });
    return;
  }
  next();
}

export function requireAdminOrSuperAdmin(req: AdminRequest, res: Response, next: NextFunction): void {
  if (!['admin', 'super_admin'].includes(req.adminRole || '')) {
    res.status(403).json({ error: 'Only admin or super admin can perform this operation' });
    return;
  }
  next();
}
