import bcrypt from 'bcryptjs';
import { query } from './db.js';

const hash = bcrypt.hashSync('admin123', 10);
await query('UPDATE admins SET password = ? WHERE email = ?', [hash, 'admin@autozap.com']);
await query('UPDATE salons SET password = ? WHERE email = ?', [hash, 'primecuts@salon.com']);
await query('UPDATE salons SET password = ? WHERE email = ?', [hash, 'styleking@salon.com']);
await query('UPDATE salons SET password = ? WHERE email = ?', [hash, 'royalhub@salon.com']);
console.log('Passwords reset to admin123 for all accounts');
