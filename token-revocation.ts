import crypto from 'crypto';
import { query, pool } from './db';

export async function initTokenRevocation() {
  try {
    if (process.env.USE_SQLITE === 'true') {
      const db = pool as any;
      db.exec(`CREATE TABLE IF NOT EXISTS revoked_tokens (
        token_hash TEXT PRIMARY KEY,
        user_type TEXT NOT NULL,
        user_id TEXT NOT NULL,
        revoked_at TEXT DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL
      )`);
      setInterval(() => {
        try {
          db.prepare('DELETE FROM revoked_tokens WHERE expires_at < datetime(\'now\')').run();
        } catch {}
      }, 60 * 60 * 1000);
    } else {
      await query(`CREATE TABLE IF NOT EXISTS revoked_tokens (
        token_hash VARCHAR(64) PRIMARY KEY,
        user_type VARCHAR(20) NOT NULL,
        user_id VARCHAR(100) NOT NULL,
        revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        INDEX idx_expires (expires_at)
      )`);
      setInterval(() => {
        try {
          query('DELETE FROM revoked_tokens WHERE expires_at < NOW()', []);
        } catch {}
      }, 60 * 60 * 1000);
    }
    console.log('[TokenRevocation] Initialized');
  } catch (e) {
    console.warn('[TokenRevocation] Table init failed:', e);
  }
}

export async function revokeRefreshToken(tokenHash: string, userType: string, userId: string, expiresAt: string) {
  try {
    await query(
      'INSERT IGNORE INTO revoked_tokens (token_hash, user_type, user_id, expires_at) VALUES (?, ?, ?, ?)',
      [tokenHash, userType, userId, expiresAt]
    );
  } catch (e) {
    console.warn('[TokenRevocation] Revoke failed:', e);
  }
}

export async function isTokenRevoked(tokenHash: string): Promise<boolean> {
  try {
    const rows = await query('SELECT 1 FROM revoked_tokens WHERE token_hash = ? LIMIT 1', [tokenHash]);
    return rows.length > 0;
  } catch {
    return false;
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
