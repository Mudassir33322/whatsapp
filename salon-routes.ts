import express from 'express';
import crypto from 'crypto';
import path from 'path';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { existsSync, mkdirSync } from 'fs';
import { pool, query, cachedQuery, setCache, clearCache, getBarbersBySalon, getBarberSchedule, getAvailableSlots, getAppointmentsByBarberAndDate, getOffersBySalon, getSalonReviews, getServicesBySalon, getSalonDetailForBot, getCustomerByPhone, getAllSeats, upsertSeat, deleteSeat, getAllProducts, upsertProduct, upsertSalonMedia, deleteSalonMedia, setSalonCoverImage, clockInBarber, clockOutBarber, getTodayAttendance, getAttendanceHistory, getSalonCustomerChats, getChatMessages, saveChatMessage, recordCustomerVisit, createSalonReview, updateReview, deleteReview, updateRevenue, updateExpense, getWalkins, updateWalkin, deleteWalkin, updateAttendance, deleteAttendance, getSalonsByLocation, getShopSettings, hashPin, beginTransaction, commit, rollback } from './db';
import { getWASocket, isWAConnected } from './notification-service';
import { generateToken, normalizePhone } from './utils';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from './auth-helper';
import { z } from 'zod';
import { phoneSchema, sanitizeString, parseId } from './security';
import { salonAuth, SalonRequest } from './middleware';

const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
if (!existsSync(uploadsDir)) { mkdirSync(uploadsDir, { recursive: true }); }
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const safeExt = allowedExts.includes(ext) ? ext : '.jpg';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WEBP, GIF files are allowed'));
    }
  }
});

// ─── Reusable ownership verification middleware ─────────────────────
function verifySalonOwnership(...types: Array<{ type: string; source: 'param' | 'body'; field: string }>) {
  return async (req: SalonRequest, res: express.Response, next: express.NextFunction) => {
    try {
      for (const { type, source, field } of types) {
        const id = source === 'param' ? req.params[field] : req.body[field];
        if (!id) continue;

        const tableMap: Record<string, string> = {
          barber: 'barbers',
          service: 'services',
          customer: 'appointments',
        };

        const table = tableMap[type];
        if (!table) continue;

        let sql: string;
        let params: any[];

        if (type === 'customer') {
          sql = 'SELECT id FROM appointments WHERE customer_phone = ? AND salon_id = ? LIMIT 1';
          params = [normalizePhone(String(id)), req.salonId];
        } else {
          sql = `SELECT id FROM \`${table}\` WHERE id = ? AND salon_id = ?`;
          params = [Number(id), req.salonId];
        }

        const rows: any = await query(sql, params);
        if (rows.length === 0) {
          return res.status(403).json({ error: `${type} not found in your salon` });
        }
      }
      next();
    } catch (e: any) {
      return res.status(500).json({ error: `Ownership verification failed: ${e.message}` });
    }
  };
}

// ─── Zod input validation middleware ────────────────────────────────
function validateBody(schema: z.ZodSchema) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues.map(i => i.message).join(', ') });
    }
    req.body = result.data;
    next();
  };
}

const barberServiceSchema = z.object({
  barber_id: z.number({ message: 'barber_id must be a number' }),
  service_id: z.number({ message: 'service_id must be a number' }),
  price: z.number().optional().nullable(),
});

const chatMessageSchema = z.object({
  message: z.string({ message: 'Message required' }).min(1, 'Message cannot be empty'),
});

export function setupSalonRoutes(app: express.Application, context?: any) {
  const { sessions, connectToWhatsApp, connectingSessions, io, cleanupSession } = context || {};
  // ─── Auth ──────────────────────────────────────────────────────────
  const loginAttempts = new Map<string, { count: number, blockedUntil: number }>();

  app.post('/api/salon/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

      const key = email.toLowerCase();
      const now = Date.now();
      const attempt = loginAttempts.get(key);
      if (attempt && attempt.blockedUntil > now) {
        const remaining = Math.ceil((attempt.blockedUntil - now) / 60000);
        return res.status(429).json({ error: `Too many attempts. Try again after ${remaining} minutes` });
      }

      const rows: any = await query('SELECT id, name, email, owner_name, phone, cover_image_url AS cover_image, logo_url AS logo, status, password FROM salons WHERE email = ?', [email]);
      if (rows.length === 0) {
        const prev = loginAttempts.get(key) || { count: 0, blockedUntil: 0 };
        prev.count++;
        if (prev.count >= 5) { prev.blockedUntil = now + 15 * 60 * 1000; prev.count = 0; }
        loginAttempts.set(key, prev);
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      if (rows[0].status !== 'active') return res.status(403).json({ error: 'Account not active. Contact admin.' });

      const salon = rows[0];

      let isValid = false;
      if (salon.password && salon.password.startsWith('$2')) {
        isValid = await bcrypt.compare(password, salon.password);
      } else if (salon.password) {
        console.warn(`[Security] Salon #${salon.id} has non-bcrypt password hash. Login rejected.`);
      }

      if (!isValid) {
        const prev = loginAttempts.get(key) || { count: 0, blockedUntil: 0 };
        prev.count++;
        if (prev.count >= 5) { prev.blockedUntil = now + 15 * 60 * 1000; prev.count = 0; }
        loginAttempts.set(key, prev);
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      loginAttempts.delete(key);
      const accessToken = generateAccessToken({ salonId: salon.id, email: salon.email });
      const refreshToken = generateRefreshToken({ salonId: salon.id, email: salon.email });
      res.json({
        token: accessToken,
        refreshToken,
        salon: {
          id: salon.id,
          name: salon.name,
          email: salon.email,
          owner_name: salon.owner_name,
          phone: salon.phone,
          cover_image: salon.cover_image,
          logo: salon.logo
        }
      });
    } catch (e: any) {
      console.error('Salon login error:', e);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.post('/api/salon/auth/refresh', async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });
      const decoded = verifyRefreshToken(refreshToken);
      if (!decoded) return res.status(401).json({ error: 'Invalid or expired refresh token' });
      const accessToken = generateAccessToken({ salonId: decoded.salonId, email: decoded.email });
      res.json({ token: accessToken });
    } catch (e: any) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
  });

  app.get('/api/salon/auth/me', salonAuth, async (req: any, res) => {
    try {
      const rows: any = await query('SELECT id, name, email, owner_name, phone, address, cover_image_url as cover_image, logo_url as logo, rating, review_count, description FROM salons WHERE id = ?', [req.salonId]);
      if (rows.length === 0) return res.status(404).json({ error: 'Salon not found' });
      res.json(rows[0]);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch salon' });
    }
  });

  app.post('/api/salon/auth/update-password', salonAuth, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });

      const rows: any = await query('SELECT password FROM salons WHERE id = ?', [req.salonId]);
      let isValid = false;
      if (rows[0]?.password) {
        if (rows[0].password.startsWith('$2')) {
          isValid = await bcrypt.compare(currentPassword, rows[0].password);
        } else {
          isValid = rows[0].password === currentPassword;
        }
      }

      if (!isValid) return res.status(401).json({ error: 'Current password incorrect' });

      const hash = await bcrypt.hash(newPassword, 10);
      await query('UPDATE salons SET password = ? WHERE id = ?', [hash, req.salonId]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Password update failed' });
    }
  });

  // ─── Seats CRUD ───────────────────────────────────────────────────
  app.get('/api/salon/seats', salonAuth, async (req: any, res) => {
    try {
      const seats = await getAllSeats(req.salonId);
      res.json(seats);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch seats' });
    }
  });

  app.post('/api/salon/seats', salonAuth, async (req: any, res) => {
    try {
      const { name, status, assigned_staff_id } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
      const dup: any = await query('SELECT id FROM seats WHERE name = ? AND salon_id = ?', [name.trim(), req.salonId]);
      if (dup.length > 0) return res.status(409).json({ error: 'A seat with this name already exists' });
      await upsertSeat({ salon_id: req.salonId, name: name.trim(), status, assigned_staff_id });
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to save seat' });
    }
  });

  app.put('/api/salon/seats/:id', salonAuth, async (req: any, res) => {
    try {
      const { name, status, assigned_staff_id } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
      const dup: any = await query('SELECT id FROM seats WHERE name = ? AND salon_id = ? AND id != ?', [name.trim(), req.salonId, req.params.id]);
      if (dup.length > 0) return res.status(409).json({ error: 'A seat with this name already exists' });
      await upsertSeat({ id: Number(req.params.id), salon_id: req.salonId, name: name.trim(), status, assigned_staff_id });
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update seat' });
    }
  });

  app.delete('/api/salon/seats/:id', salonAuth, async (req: any, res) => {
    try {
      const seatRows: any = await query('SELECT id FROM seats WHERE id = ? AND salon_id = ?', [Number(req.params.id), req.salonId]);
      if (seatRows.length === 0) return res.status(404).json({ error: 'Seat not found' });
      await deleteSeat(Number(req.params.id));
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete seat' });
    }
  });

  // ─── Inventory / Products CRUD ──────────────────────────────────
  app.get('/api/salon/products', salonAuth, async (req: any, res) => {
    try {
      const products = await getAllProducts(req.salonId);
      res.json(products);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  app.post('/api/salon/products', salonAuth, async (req: any, res) => {
    try {
      const { name, price, stock, min_stock, unit } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
      if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0) return res.status(400).json({ error: 'Valid price required' });
      if (stock !== undefined && (isNaN(Number(stock)) || Number(stock) < 0)) return res.status(400).json({ error: 'Valid stock required' });
      const dup: any = await query('SELECT id FROM products WHERE name = ? AND salon_id = ?', [name.trim(), req.salonId]);
      if (dup.length > 0) return res.status(409).json({ error: 'A product with this name already exists' });
      await upsertProduct({ id: undefined, salon_id: req.salonId, name: name.trim(), price: Number(price), stock: stock !== undefined ? Number(stock) : 0, min_stock: min_stock !== undefined ? Number(min_stock) : 0, unit });
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to create product' });
    }
  });

  app.put('/api/salon/products/:id', salonAuth, async (req: any, res) => {
    try {
      const { name, price, stock, min_stock, unit } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
      if (price !== undefined && (isNaN(Number(price)) || Number(price) < 0)) return res.status(400).json({ error: 'Valid price required' });
      const existing: any = await query('SELECT id FROM products WHERE id = ? AND salon_id = ?', [req.params.id, req.salonId]);
      if (existing.length === 0) return res.status(404).json({ error: 'Product not found' });
      const dup: any = await query('SELECT id FROM products WHERE name = ? AND salon_id = ? AND id != ?', [name.trim(), req.salonId, req.params.id]);
      if (dup.length > 0) return res.status(409).json({ error: 'A product with this name already exists' });
      await upsertProduct({ id: Number(req.params.id), salon_id: req.salonId, name: name.trim(), price: Number(price), stock: stock !== undefined ? Number(stock) : 0, min_stock: min_stock !== undefined ? Number(min_stock) : 0, unit });
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update product' });
    }
  });

  app.delete('/api/salon/products/:id', salonAuth, async (req: any, res) => {
    try {
      await query('DELETE FROM products WHERE id = ? AND salon_id = ?', [req.params.id, req.salonId]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete product' });
    }
  });

  app.post('/api/salon/send-stock-alert', salonAuth, async (req: any, res) => {
    try {
      const { product_id, message } = req.body;
      const sock = getWASocket();
      if (sock) {
        const salon: any = await query('SELECT phone FROM salons WHERE id = ?', [req.salonId]);
        if (salon && salon.length > 0 && salon[0].phone) {
          await sock.sendMessage(salon[0].phone + '@s.whatsapp.net', { text: message || `Stock alert: Product #${product_id} running low.` });
        }
      }
      res.json({ success: true, alert_sent: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to send stock alert' });
    }
  });

  // ─── Dashboard ─────────────────────────────────────────────────────
  app.get('/api/salon/dashboard', salonAuth, async (req: any, res) => {
    try {
      const sid = req.salonId;
      const today = new Date().toISOString().split('T')[0];

      const [todayAppts, todayCompleted, todayPending, totalBarbers, totalCustomers, totalAppts, todaySchedule, revenueToday, recentLeads]: any = await Promise.all([
        query(`SELECT COUNT(*) as total FROM appointments WHERE salon_id = ? AND appointment_date = ? AND status NOT IN ('cancelled','no_show')`, [sid, today]),
        query(`SELECT COUNT(*) as total FROM appointments WHERE salon_id = ? AND appointment_date = ? AND status = 'completed'`, [sid, today]),
        query(`SELECT COUNT(*) as total FROM appointments WHERE salon_id = ? AND appointment_date = ? AND status = 'confirmed'`, [sid, today]),
        query(`SELECT COUNT(*) as total FROM barbers WHERE salon_id = ? AND status = 'active'`, [sid]),
        query(`SELECT COUNT(DISTINCT customer_phone) as total FROM appointments WHERE salon_id = ?`, [sid]),
        query(`SELECT COUNT(*) as total FROM appointments WHERE salon_id = ?`, [sid]),
        query(`SELECT a.id, a.customer_phone, a.customer_name, a.appointment_time, a.end_time, a.status, a.token, b.name as barber_name, s.name as service_name FROM appointments a JOIN barbers b ON a.barber_id = b.id JOIN services s ON a.service_id = s.id WHERE a.salon_id = ? AND a.appointment_date = ? ORDER BY a.appointment_time`, [sid, today]),
        query(`SELECT COALESCE(SUM(s.price), 0) as total FROM appointments a JOIN services s ON a.service_id = s.id WHERE a.salon_id = ? AND a.appointment_date = ? AND a.status = 'completed'`, [sid, today]),
        query(`SELECT a.id, a.customer_phone, a.appointment_date, a.appointment_time, a.status, c.name as customer_name, c.last_status, b.name as barber_name FROM appointments a LEFT JOIN customers c ON a.customer_phone = c.phone LEFT JOIN barbers b ON a.barber_id = b.id WHERE a.salon_id = ? ORDER BY a.created_at DESC LIMIT 10`, [sid]),
      ]);

      res.json({
        todayBookings: todayAppts[0]?.total || 0,
        todayCompleted: todayCompleted[0]?.total || 0,
        todayPending: todayPending[0]?.total || 0,
        totalBarbers: totalBarbers[0]?.total || 0,
        totalCustomers: totalCustomers[0]?.total || 0,
        totalAppointments: totalAppts[0]?.total || 0,
        todayRevenue: revenueToday[0]?.total || 0,
        todaySchedule,
        recentLeads
      });
    } catch (e: any) {
      console.error('Dashboard error:', e);
      res.status(500).json({ error: 'Failed to load dashboard' });
    }
  });

  app.get('/api/salon/leads', salonAuth, async (req: any, res) => {
    try {
      const rows: any = await query(
        `SELECT a.*, c.name as customer_name, c.last_status, b.name as barber_name
         FROM appointments a
         LEFT JOIN customers c ON a.customer_phone = c.phone
         LEFT JOIN barbers b ON a.barber_id = b.id
         WHERE a.salon_id = ?
         ORDER BY a.created_at DESC LIMIT 50`,
        [req.salonId]
      );
      res.json(rows);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch leads' });
    }
  });

  // ─── Barbers CRUD ─────────────────────────────────────────────────
  app.get('/api/salon/barbers', salonAuth, async (req: any, res) => {
    try {
      const includePin = req.query.pin === '1';
      const barbers = await getBarbersBySalon(req.salonId, includePin);
      res.json(barbers);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch barbers' });
    }
  });

  app.post('/api/salon/barbers', salonAuth, async (req: any, res) => {
    try {
      const { name, phone, email, bio, experience, specialization, profile_image } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
      if (phone && !phoneSchema.safeParse(phone).success) return res.status(400).json({ error: 'Valid phone number required' });
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Valid email required' });
      const dup: any = await query('SELECT id FROM barbers WHERE name = ? AND salon_id = ?', [name.trim(), req.salonId]);
      if (dup.length > 0) return res.status(409).json({ error: 'A barber with this name already exists' });
      const pinBytes = crypto.randomBytes(2);
      const pin = String(1000 + (pinBytes[0] << 8 | pinBytes[1]) % 9000);
      const pinHash = hashPin(pin);
      const r: any = await query(
        `INSERT INTO barbers (salon_id, name, phone, email, bio, experience, specialization, profile_image, pin_code) VALUES (?,?,?,?,?,?,?,?,?)`,
        [req.salonId, name.trim(), phone || null, email || null, bio || null, experience || 0, specialization || null, profile_image || null, pinHash]
      );
      res.json({ success: true, id: r.insertId, pin_code: pin });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to create barber' });
    }
  });

  app.put('/api/salon/barbers/:id', salonAuth, async (req: any, res) => {
    try {
      const { name, phone, email, bio, experience, specialization, profile_image, status } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
      if (phone && !phoneSchema.safeParse(phone).success) return res.status(400).json({ error: 'Valid phone number required' });
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Valid email required' });
      const dup: any = await query('SELECT id FROM barbers WHERE name = ? AND salon_id = ? AND id != ?', [name.trim(), req.salonId, req.params.id]);
      if (dup.length > 0) return res.status(409).json({ error: 'A barber with this name already exists' });
      await query(
        `UPDATE barbers SET name=?, phone=?, email=?, bio=?, experience=?, specialization=?, profile_image=?, status=? WHERE id=? AND salon_id=?`,
        [name.trim(), phone || null, email || null, bio || null, experience || 0, specialization || null, profile_image || null, status || 'active', req.params.id, req.salonId]
      );
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update barber' });
    }
  });

  app.delete('/api/salon/barbers/:id', salonAuth, async (req: any, res) => {
    try {
      await query('DELETE FROM barbers WHERE id = ? AND salon_id = ?', [req.params.id, req.salonId]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete barber' });
    }
  });

// Barber Schedule
   app.get('/api/salon/barbers/:id/schedule', salonAuth, async (req: any, res) => {
     try {
       // Security: Check barber belongs to this salon
       const barberCheck: any = await query('SELECT id FROM barbers WHERE id = ? AND salon_id = ?', [req.params.id, req.salonId]);
       if (barberCheck.length === 0) return res.status(403).json({ error: 'Barber not found in your salon' });
       const schedule = await getBarberSchedule(Number(req.params.id));
       res.json(schedule);
     } catch (e: any) {
       console.error('[Salon Route Error]', e?.message || e);
       res.status(500).json({ error: 'Failed to fetch schedule' });
     }
   });

   app.put('/api/salon/barbers/:id/schedule', salonAuth, async (req: any, res) => {
     try {
       const { schedule } = req.body;
       if (!Array.isArray(schedule)) return res.status(400).json({ error: 'Schedule array required' });
       // Security: Verify barber belongs to this salon
        const barber: any = await query('SELECT id FROM barbers WHERE id = ? AND salon_id = ?', [req.params.id, req.salonId]);
        if (barber.length === 0) return res.status(403).json({ error: 'Barber not found in your salon' });

        await beginTransaction();
        try {
          await query('DELETE FROM barber_schedule WHERE barber_id = ?', [req.params.id]);
          for (const s of schedule) {
            const dayMap: Record<string, number> = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };
            const dayNum = typeof s.day_of_week === 'string'
              ? dayMap[s.day_of_week.toLowerCase()] ?? 0
              : Number(s.day_of_week);
            await query(
              `INSERT INTO barber_schedule (barber_id, day_of_week, start_time, end_time, slot_duration, is_available, break_start, break_end) VALUES (?,?,?,?,?,?,?,?)`,
              [req.params.id, dayNum, s.start_time, s.end_time, s.slot_duration || 30, s.is_available !== false, s.break_start || null, s.break_end || null]
            );
          }
          await commit();
        } catch (txError) {
          await rollback().catch(() => {});
          throw txError;
        }
        res.json({ success: true });
     } catch (e: any) {
       console.error('Schedule error:', e);
       res.status(500).json({ error: 'Failed to update schedule' });
     }
   });

  // ─── Services CRUD ────────────────────────────────────────────────
  app.get('/api/salon/services', salonAuth, async (req: any, res) => {
    try {
      const services = await getServicesBySalon(req.salonId);
      res.json(services);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch services' });
    }
  });

  app.post('/api/salon/services', salonAuth, async (req: any, res) => {
    try {
      const { name, description, price, duration, category } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
      if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0) return res.status(400).json({ error: 'Valid price required' });
      const dup: any = await query('SELECT id FROM services WHERE name = ? AND salon_id = ?', [name.trim(), req.salonId]);
      if (dup.length > 0) return res.status(409).json({ error: 'A service with this name already exists' });
      const r: any = await query(
        `INSERT INTO services (salon_id, name, description, price, duration, category, is_active) VALUES (?,?,?,?,?,?,TRUE)`,
        [req.salonId, name.trim(), description || null, Number(price), duration || 30, category || null]
      );
      res.json({ success: true, id: r.insertId });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to create service' });
    }
  });

  app.put('/api/salon/services/:id', salonAuth, async (req: any, res) => {
    try {
      const { name, description, price, duration, category, is_active } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
      if (price !== undefined && (isNaN(Number(price)) || Number(price) < 0)) return res.status(400).json({ error: 'Valid price required' });
      const dup: any = await query('SELECT id FROM services WHERE name = ? AND salon_id = ? AND id != ?', [name.trim(), req.salonId, req.params.id]);
      if (dup.length > 0) return res.status(409).json({ error: 'A service with this name already exists' });
      await query(
        `UPDATE services SET name=?, description=?, price=?, duration=?, category=?, is_active=? WHERE id=? AND salon_id=?`,
        [name.trim(), description || null, price, duration || 30, category || null, is_active !== undefined ? is_active : true, req.params.id, req.salonId]
      );
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update service' });
    }
  });

  app.delete('/api/salon/services/:id', salonAuth, async (req: any, res) => {
    try {
      await query('DELETE FROM services WHERE id = ? AND salon_id = ?', [req.params.id, req.salonId]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete service' });
    }
  });

  // Link barber to service
  app.post('/api/salon/barber-services', salonAuth, validateBody(barberServiceSchema), verifySalonOwnership(
    { type: 'barber', source: 'body', field: 'barber_id' },
    { type: 'service', source: 'body', field: 'service_id' }
  ), async (req: any, res) => {
    try {
      const { barber_id, service_id, price } = req.body;
      await query(
        `INSERT INTO barber_services (barber_id, service_id, price) VALUES (?,?,?) ON DUPLICATE KEY UPDATE price=?`,
        [barber_id, service_id, price || null, price || null]
      );
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to link service' });
    }
  });

  app.delete('/api/salon/barber-services', salonAuth, validateBody(barberServiceSchema), verifySalonOwnership(
    { type: 'barber', source: 'body', field: 'barber_id' },
    { type: 'service', source: 'body', field: 'service_id' }
  ), async (req: any, res) => {
    try {
      const { barber_id, service_id } = req.body;
      await query('DELETE FROM barber_services WHERE barber_id=? AND service_id=?', [barber_id, service_id]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to unlink service' });
    }
  });

  app.get('/api/salon/barber-services/:barberId', salonAuth, async (req: any, res) => {
    try {
      const barber: any = await query('SELECT id FROM barbers WHERE id = ? AND salon_id = ?', [req.params.barberId, req.salonId]);
      if (barber.length === 0) return res.status(403).json({ error: 'Barber not found in your salon' });
      const rows: any = await query(
        `SELECT s.*, bs.price as custom_price 
         FROM barber_services bs 
         JOIN services s ON bs.service_id = s.id 
         WHERE bs.barber_id = ?`,
        [req.params.barberId]
      );
      res.json(rows);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch barber services' });
    }
  });

  // ─── Appointments ─────────────────────────────────────────────────
  app.get('/api/salon/appointments', salonAuth, async (req: any, res) => {
    try {
      const { date, date_from, date_to, barber_id, status } = req.query;
      let sql = `SELECT a.*, b.name as barber_name, s.name as service_name, a.recurring_booking_id, rb.frequency, rb.day_of_week, rb.day_of_month
                 FROM appointments a 
                 JOIN barbers b ON a.barber_id = b.id 
                 JOIN services s ON a.service_id = s.id 
                 LEFT JOIN recurring_bookings rb ON a.recurring_booking_id = rb.id
                 WHERE a.salon_id = ?`;
      const params: any[] = [req.salonId];

      if (date) { sql += ' AND a.appointment_date = ?'; params.push(date); }
      if (date_from) { sql += ' AND a.appointment_date >= ?'; params.push(date_from); }
      if (date_to) { sql += ' AND a.appointment_date <= ?'; params.push(date_to); }
      if (barber_id) { const bId = Number(barber_id); if (!isNaN(bId)) { sql += ' AND a.barber_id = ?'; params.push(bId); } }
      if (status) { sql += ' AND a.status = ?'; params.push(status); }

      sql += ' ORDER BY a.appointment_date DESC, a.appointment_time ASC';
      const rows = await query(sql, params);
      res.json(rows);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch appointments' });
    }
  });

  app.put('/api/salon/appointments/:id/status', salonAuth, async (req: any, res) => {
    try {
      const { status } = req.body;
      const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
      if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

      // Verify appointment belongs to this salon
      const apt: any = await query(
        `SELECT a.*, b.name as barber_name, s.name as service_name, sl.name as salon_name
         FROM appointments a
         JOIN barbers b ON a.barber_id = b.id
         JOIN services s ON a.service_id = s.id
         JOIN salons sl ON a.salon_id = sl.id
         WHERE a.id = ? AND a.salon_id = ?`,
        [req.params.id, req.salonId]
      );
      if (apt.length === 0) return res.status(404).json({ error: 'Appointment not found' });

      await query('UPDATE appointments SET status = ? WHERE id = ?', [status, req.params.id]);

      // Trigger review request when completed
      if (status === 'completed') {
        try {
          await recordCustomerVisit(apt[0].customer_phone);
          const { sendReviewRequest } = await import('./notification-service');
          await sendReviewRequest(apt[0]);
        } catch (_) { /* non-critical */ }
      }

      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update status' });
    }
  });

  // ─── Delete Appointment ─────────────────────────────────────────
  app.delete('/api/salon/appointments/:id', salonAuth, async (req: any, res) => {
    try {
      const apt: any = await query(
        'SELECT id FROM appointments WHERE id = ? AND salon_id = ?',
        [req.params.id, req.salonId]
      );
      if (apt.length === 0) return res.status(404).json({ error: 'Appointment not found' });
      await query('DELETE FROM appointments WHERE id = ? AND salon_id = ?', [req.params.id, req.salonId]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete appointment' });
    }
  });

  // ─── Edit Appointment ──────────────────────────────────────────
  app.put('/api/salon/appointments/:id', salonAuth, async (req: any, res) => {
    try {
      const apt: any = await query(
        'SELECT id FROM appointments WHERE id = ? AND salon_id = ?',
        [req.params.id, req.salonId]
      );
      if (apt.length === 0) return res.status(404).json({ error: 'Appointment not found' });
      await updateWalkin(Number(req.params.id), req.salonId, req.body);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update appointment' });
    }
  });

// ─── Working Hours ────────────────────────────────────────────────
    app.get('/api/salon/working-hours', salonAuth, async (req: any, res) => {
      try {
        const rows: any = await query('SELECT *, day as day_of_week, CASE WHEN is_open = 0 THEN 1 ELSE 0 END as is_off FROM working_hours WHERE salon_id = ? ORDER BY day', [req.salonId]);
        res.json(rows);
      } catch (e: any) {
        console.error('[Salon Route Error]', e?.message || e);
        res.status(500).json({ error: 'Failed to fetch working hours' });
      }
    });

    app.put('/api/salon/working-hours', salonAuth, async (req: any, res) => {
      try {
        const { hours } = req.body;
        if (!Array.isArray(hours)) return res.status(400).json({ error: 'Hours array required' });

        await beginTransaction();
        try {
          await query('DELETE FROM working_hours WHERE salon_id = ?', [req.salonId]);
          for (const h of hours) {
            await query(
              `INSERT INTO working_hours (salon_id, day, start_time, end_time, is_open) VALUES (?,?,?,?,?)`,
              [req.salonId, h.day_of_week, h.start_time, h.end_time, h.is_off ? 0 : 1]
            );
          }
          await commit();
        } catch (txError) {
          await rollback().catch(() => {});
          throw txError;
        }
        res.json({ success: true });
      } catch (e: any) {
        console.error('[Salon Route Error]', e?.message || e);
        res.status(500).json({ error: 'Failed to update working hours' });
      }
    });

   // ─── Location Filter Endpoint (for admin/salon filtering) ───────────────────
   app.get('/api/salon/locations', salonAuth, async (req: any, res) => {
     try {
       const { country_id, city_id, area_id } = req.query;
       
       // Get countries for filter
       const countries: any = await query('SELECT id, name, phone_code FROM countries WHERE is_active = TRUE ORDER BY name');
       
       // Get cities if country_id provided
       let cities: any = [];
       if (country_id) {
         cities = await query('SELECT id, name FROM cities WHERE country_id = ? AND is_active = TRUE ORDER BY name', [country_id]);
       }
       
       // Get areas if city_id provided
       let areas: any = [];
       if (city_id) {
         areas = await query('SELECT id, name FROM areas WHERE city_id = ? AND is_active = TRUE ORDER BY name', [city_id]);
       }
       
       // Get filtered salons
       const salons = await getSalonsByLocation(
         country_id ? Number(country_id) : undefined,
         city_id ? Number(city_id) : undefined,
         area_id ? Number(area_id) : undefined
       );
       
       res.json({ countries, cities, areas, salons });
     } catch (e: any) {
       console.error('[Salon Route Error]', e?.message || e);
       res.status(500).json({ error: 'Failed to fetch locations' });
     }
   });

   // ─── Offers CRUD ──────────────────────────────────────────────────
  app.get('/api/salon/offers', salonAuth, async (req: any, res) => {
    try {
      const allOffers: any = await query('SELECT * FROM offers WHERE salon_id = ? ORDER BY created_at DESC', [req.salonId]);
      res.json(allOffers);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch offers' });
    }
  });

  app.post('/api/salon/offers', salonAuth, async (req: any, res) => {
    try {
      const { title, description, discount_percent, valid_from, valid_until, is_active } = req.body;
      if (!title) return res.status(400).json({ error: 'Title required' });
      const r: any = await query(
        `INSERT INTO offers (salon_id, title, description, discount_percent, valid_from, valid_until, is_active) VALUES (?,?,?,?,?,?,?)`,
        [req.salonId, title, description || null, discount_percent || null, valid_from || null, valid_until || null, is_active !== false]
      );
      res.json({ success: true, id: r.insertId });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to create offer' });
    }
  });

  app.put('/api/salon/offers/:id', salonAuth, async (req: any, res) => {
    try {
      const { title, description, discount_percent, valid_from, valid_until, is_active } = req.body;
      await query(
        `UPDATE offers SET title=?, description=?, discount_percent=?, valid_from=?, valid_until=?, is_active=? WHERE id=? AND salon_id=?`,
        [title, description || null, discount_percent || null, valid_from || null, valid_until || null, is_active !== false, req.params.id, req.salonId]
      );
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update offer' });
    }
  });

  app.delete('/api/salon/offers/:id', salonAuth, async (req: any, res) => {
    try {
      await query('DELETE FROM offers WHERE id = ? AND salon_id = ?', [req.params.id, req.salonId]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete offer' });
    }
  });

  // ─── Reviews ──────────────────────────────────────────────────────
  app.get('/api/salon/reviews', salonAuth, async (req: any, res) => {
    try {
      const reviews = await getSalonReviews(req.salonId, 50);
      res.json(reviews);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch reviews' });
    }
  });

  app.post('/api/salon/reviews', salonAuth, async (req: any, res) => {
    try {
      const { customer_phone, rating, comment } = req.body;
      if (!customer_phone || !rating) return res.status(400).json({ error: 'customer_phone and rating required' });
      await createSalonReview({ salon_id: req.salonId, customer_phone, rating: Number(rating), comment });
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to create review' });
    }
  });

  app.put('/api/salon/reviews/:id', salonAuth, async (req: any, res) => {
    try {
      const { rating, comment } = req.body;
      if (rating === undefined && comment === undefined) return res.status(400).json({ error: 'rating or comment required' });
      const review: any = await query('SELECT id FROM reviews WHERE id = ? AND salon_id = ?', [req.params.id, req.salonId]);
      if (review.length === 0) return res.status(403).json({ error: 'Review not found in your salon' });
      await updateReview(Number(req.params.id), { rating: rating ? Number(rating) : undefined, comment });
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update review' });
    }
  });

  app.delete('/api/salon/reviews/:id', salonAuth, async (req: any, res) => {
    try {
      const review: any = await query('SELECT id FROM reviews WHERE id = ? AND salon_id = ?', [req.params.id, req.salonId]);
      if (review.length === 0) return res.status(403).json({ error: 'Review not found in your salon' });
      await deleteReview(Number(req.params.id));
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete review' });
    }
  });

  // ─── Customers ────────────────────────────────────────────────────
  app.get('/api/salon/customers', salonAuth, async (req: any, res) => {
    try {
      const { search } = req.query;
      let sql = `SELECT DISTINCT a.customer_phone, a.customer_name, 
                  COUNT(a.id) as total_visits, 
                  COALESCE(c.loyalty_points, 0) as loyalty_points,
                  MAX(a.appointment_date) as last_visit,
                  COALESCE(c.status, 0) as status,
                  c.last_active
                 FROM appointments a 
                 LEFT JOIN customers c ON a.customer_phone = c.phone
                 WHERE a.salon_id = ?`;
      const params: any[] = [req.salonId];

      if (search) {
        sql += ' AND (a.customer_phone LIKE ? OR a.customer_name LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      sql += ' GROUP BY a.customer_phone ORDER BY last_visit DESC';
      const rows = await query(sql, params);
      res.json(rows);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch customers' });
    }
  });

  app.get('/api/salon/customers/:phone', salonAuth, async (req: any, res) => {
    try {
      const customer = await getCustomerByPhone(req.params.phone);
      if (!customer) return res.status(404).json({ error: 'Customer not found' });

      const appointments: any = await query(
        `SELECT a.*, b.name as barber_name, s.name as service_name 
         FROM appointments a 
         JOIN barbers b ON a.barber_id = b.id 
         JOIN services s ON a.service_id = s.id 
         WHERE a.customer_phone = ? AND a.salon_id = ?
         ORDER BY a.appointment_date DESC LIMIT 20`,
        [req.params.phone, req.salonId]
      );

      res.json({ customer, appointments });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch customer' });
    }
  });

  app.post('/api/salon/customers', salonAuth, async (req: any, res) => {
    try {
      const { phone, name } = req.body;
      if (!phone) return res.status(400).json({ error: 'Phone is required' });
      await query('INSERT INTO customers (phone, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = ?', [phone, name || phone, name || phone]);
      res.json({ success: true, message: 'Customer created' });
    } catch (e: any) { console.error('[Salon Route Error]', e?.message || e); res.status(500).json({ error: 'Failed to create customer' }); }
  });

  app.put('/api/salon/customers/:phone', salonAuth, async (req: any, res) => {
    try {
      const { name, status } = req.body;
      const phone = normalizePhone(req.params.phone);
      const belongs: any = await query('SELECT id FROM appointments WHERE customer_phone = ? AND salon_id = ? LIMIT 1', [phone, req.salonId]);
      if (belongs.length === 0) return res.status(403).json({ error: 'Customer not found in your salon' });
      const updates: string[] = [];
      const params: any[] = [];
      if (name !== undefined) { updates.push('name = ?'); params.push(sanitizeString(name)); }
      if (status !== undefined) { updates.push('status = ?'); params.push(status); }
      if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
      params.push(phone);
      await query(`UPDATE customers SET ${updates.join(', ')} WHERE phone = ?`, params);
      res.json({ success: true });
    } catch (e: any) { console.error('[Salon Route Error]', e?.message || e); res.status(500).json({ error: 'Failed to update customer' }); }
  });

  app.delete('/api/salon/customers/:phone', salonAuth, async (req: any, res) => {
    try {
      const phone = normalizePhone(req.params.phone);
      const belongs: any = await query('SELECT id FROM appointments WHERE customer_phone = ? AND salon_id = ? LIMIT 1', [phone, req.salonId]);
      if (belongs.length === 0) return res.status(403).json({ error: 'Customer not found in your salon' });
      await query('DELETE FROM customer_tags WHERE customer_phone = ?', [phone]);
      await query('DELETE FROM customers WHERE phone = ?', [phone]);
      res.json({ success: true });
    } catch (e: any) { console.error('[Salon Route Error]', e?.message || e); res.status(500).json({ error: 'Failed to delete customer' }); }
  });

  // ─── Salon Customer Chats ─────────────────────────────────────────
  app.get('/api/salon/chats', salonAuth, async (req: any, res) => {
    try {
      const contacts = await getSalonCustomerChats(req.salonId);
      res.json(contacts);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch chats' });
    }
  });

  app.get('/api/salon/chats/:phone/messages', salonAuth, async (req: any, res) => {
    try {
      const phone = req.params.phone.includes('@s.whatsapp.net') ? req.params.phone : `${req.params.phone}@s.whatsapp.net`;
      const belongs: any = await query(
        `SELECT a.id FROM appointments a WHERE a.customer_phone = ? AND a.salon_id = ? LIMIT 1`,
        [normalizePhone(req.params.phone), req.salonId]
      );
      if (belongs.length === 0) return res.status(403).json({ error: 'This customer does not belong to your salon' });
      const messages = await getChatMessages(phone);
      res.json(messages);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  app.post('/api/salon/chats/:phone/send', salonAuth, validateBody(chatMessageSchema), async (req: any, res) => {
    try {
      const { message } = req.body;
      const phone = req.params.phone;
      const rawPhone = normalizePhone(phone);
      const fullPhone = rawPhone ? `${rawPhone}@s.whatsapp.net` : phone;

      // Verify customer has visited this salon
      const belongs: any = await query(
        'SELECT a.id FROM appointments a WHERE a.customer_phone = ? AND a.salon_id = ? LIMIT 1',
        [rawPhone, req.salonId]
      );
      if (belongs.length === 0) return res.status(403).json({ error: 'This customer does not belong to your salon' });

      const sock = getWASocket();
      if (!sock || !isWAConnected()) return res.status(500).json({ error: 'WhatsApp not connected' });
      await sock.sendMessage(fullPhone, { text: message });
      await saveChatMessage({
        sessionId: `salon_${req.salonId}`,
        phone: fullPhone,
        text: message,
        fromMe: true
      });
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // ─── Analytics ────────────────────────────────────────────────────
  app.get('/api/salon/analytics', salonAuth, async (req: any, res) => {
    try {
      const sid = req.salonId;
      const { period = '7d' } = req.query;
      const days = period === '30d' ? 30 : period === '1y' ? 365 : 7;
      const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

      // Revenue over time
      const revenueOverTime: any = await query(
        `SELECT a.appointment_date as date, COALESCE(SUM(s.price), 0) as revenue
         FROM appointments a 
         JOIN services s ON a.service_id = s.id 
         WHERE a.salon_id = ? AND a.appointment_date >= ? AND a.status = 'completed'
         GROUP BY a.appointment_date ORDER BY a.appointment_date`,
        [sid, since]
      );

      // Bookings over time
      const bookingsOverTime: any = await query(
        `SELECT appointment_date as date, COUNT(*) as count
         FROM appointments 
         WHERE salon_id = ? AND appointment_date >= ? AND status NOT IN ('cancelled','no_show')
         GROUP BY appointment_date ORDER BY appointment_date`,
        [sid, since]
      );

      // Top services
      const topServices: any = await query(
        `SELECT s.name, COUNT(a.id) as count, COALESCE(SUM(s.price), 0) as revenue
         FROM appointments a 
         JOIN services s ON a.service_id = s.id 
         WHERE a.salon_id = ? AND a.appointment_date >= ? AND a.status = 'completed'
         GROUP BY a.service_id ORDER BY count DESC LIMIT 10`,
        [sid, since]
      );

      // Top barbers
      const topBarbers: any = await query(
        `SELECT b.name, COUNT(a.id) as count, COALESCE(SUM(s.price), 0) as revenue
         FROM appointments a 
         JOIN barbers b ON a.barber_id = b.id 
         JOIN services s ON a.service_id = s.id 
         WHERE a.salon_id = ? AND a.appointment_date >= ? AND a.status = 'completed'
         GROUP BY a.barber_id ORDER BY count DESC LIMIT 10`,
        [sid, since]
      );

      // Peak hours
      const peakHours: any = await query(
        `SELECT HOUR(appointment_time) as hour, COUNT(*) as count
         FROM appointments 
         WHERE salon_id = ? AND appointment_date >= ? AND status NOT IN ('cancelled','no_show')
         GROUP BY HOUR(appointment_time) ORDER BY count DESC`,
        [sid, since]
      );

      // Status distribution
      const statusDist: any = await query(
        `SELECT status, COUNT(*) as count FROM appointments WHERE salon_id = ? GROUP BY status`,
        [sid]
      );

      res.json({ revenueOverTime, bookingsOverTime, topServices, topBarbers, peakHours, statusDist });
    } catch (e: any) {
      console.error('Analytics error:', e);
      res.status(500).json({ error: 'Failed to load analytics' });
    }
  });

  // ─── Shop Settings (salon-wise) ────────────────────────────────
  app.get('/api/salon/shop/settings', salonAuth, async (req: any, res) => {
    try {
      const settings = await getShopSettings(req.salonId);
      res.json(settings);
    } catch (e: any) {
      console.error('[Salon Shop Settings Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch shop settings' });
    }
  });

  app.put('/api/salon/shop/settings', salonAuth, async (req: any, res) => {
    try {
      const { company_name, currency, language, address, map_url } = req.body;
      // Idempotent upsert — avoids "Duplicate entry '<id>' for key 'salon_id'"
      // that happened under concurrent loads with the old SELECT+INSERT pattern.
      await query(
        `INSERT INTO shop_settings (salon_id, company_name, currency, language, address, map_url)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE company_name=VALUES(company_name), currency=VALUES(currency), language=VALUES(language), address=VALUES(address), map_url=VALUES(map_url)`,
        [req.salonId, company_name || '', currency || 'Rs.', language || 'Urdu/English', address || '', map_url || '']
      );
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Shop Settings Update Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update shop settings' });
    }
  });

  // ─── Settings ─────────────────────────────────────────────────────
  app.get('/api/salon/settings', salonAuth, async (req: any, res) => {
    try {
      const cached = cachedQuery(`settings_${req.salonId}`, 30000);
      if (cached) return res.json(cached.data);
      const rows: any = await query(
        `SELECT id, name, owner_name, phone, owner_phone, email, address, description, cover_image_url as cover_image, logo_url as logo, latitude, longitude FROM salons WHERE id = ?`,
        [req.salonId]
      );
      const data = rows[0] || {};
      setCache(`settings_${req.salonId}`, data);
      res.json(data);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  });

  app.put('/api/salon/settings', salonAuth, async (req: any, res) => {
    try {
      const { name, owner_name, phone, owner_phone, address, description, cover_image, logo, latitude, longitude } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Salon name required' });
      }
      // Check for duplicate phone before update
      if (phone) {
        const phoneDup = await query('SELECT id FROM salons WHERE phone = ? AND id != ?', [phone, req.salonId]);
        if (phoneDup.length > 0) {
          return res.status(409).json({ error: 'Phone number already registered with another salon' });
        }
      }
      const existing: any = await query('SELECT id FROM salons WHERE name = ? AND id != ?', [name.trim(), req.salonId]);
      if (existing.length > 0) {
        return res.status(409).json({ error: 'A salon with this name already exists' });
      }
      await query(
        `UPDATE salons SET name=?, owner_name=?, phone=?, owner_phone=?, address=?, description=?, cover_image_url=?, logo_url=?, latitude=?, longitude=? WHERE id=?`,
        [name.trim(), owner_name, phone, owner_phone || null, address, description, cover_image || null, logo || null, latitude || null, longitude || null, req.salonId]
      );
      clearCache(`settings_${req.salonId}`);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      if (e?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Phone or email is already registered with another salon' });
      }
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  // ─── Finances (Own Salon) ──────────────────────────────────────────
  app.get('/api/salon/finances', salonAuth, async (req: any, res) => {
    try {
      const sid = req.salonId;
      const revenue: any = await query(
        `SELECT COALESCE(SUM(s.price), 0) as total FROM appointments a
         JOIN services s ON a.service_id = s.id
         WHERE a.salon_id = ? AND a.status = 'completed'`,
        [sid]
      );
      const expenses: any = await query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE salon_id = ?`,
        [sid]
      );
      const totalRevenue = revenue[0]?.total || 0;
      const totalExpenses = expenses[0]?.total || 0;
      res.json({ revenue: totalRevenue, expenses: totalExpenses, profit: totalRevenue - totalExpenses });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch finances' });
    }
  });

  app.get('/api/salon/revenue', salonAuth, async (req: any, res) => {
    try { const rows: any = await query('SELECT * FROM revenue WHERE salon_id = ? ORDER BY date DESC LIMIT 100', [req.salonId]); res.json(rows); }
    catch (e: any) { console.error(e); res.status(500).json({ error: 'Failed' }); }
  });

  app.post('/api/salon/revenue', salonAuth, async (req: any, res) => {
    try { const { amount, date } = req.body; if (!amount && amount !== 0) return res.status(400).json({ error: 'amount and date required' });
      if (!date) return res.status(400).json({ error: 'date required' });
      if (isNaN(Number(amount)) || Number(amount) < 0) return res.status(400).json({ error: 'Valid amount required' });
      await query('INSERT INTO revenue (salon_id, amount, date) VALUES (?, ?, ?)', [req.salonId, Number(amount), date]); res.json({ success: true }); }
    catch (e: any) { console.error(e); res.status(500).json({ error: 'Failed' }); }
  });

  app.delete('/api/salon/revenue/:id', salonAuth, async (req: any, res) => {
    try { await query('DELETE FROM revenue WHERE id = ? AND salon_id = ?', [req.params.id, req.salonId]); res.json({ success: true }); }
    catch (e: any) { console.error(e); res.status(500).json({ error: 'Failed' }); }
  });

  app.put('/api/salon/revenue/:id', salonAuth, async (req: any, res) => {
    try { await updateRevenue(Number(req.params.id), req.body); res.json({ success: true }); }
    catch (e: any) { console.error(e); res.status(500).json({ error: 'Failed' }); }
  });

  app.get('/api/salon/expenses', salonAuth, async (req: any, res) => {
    try { const rows: any = await query('SELECT * FROM expenses WHERE salon_id = ? ORDER BY date DESC LIMIT 100', [req.salonId]); res.json(rows); }
    catch (e: any) { console.error(e); res.status(500).json({ error: 'Failed' }); }
  });

  app.post('/api/salon/expenses', salonAuth, async (req: any, res) => {
    try { const { amount, date, description, category } = req.body;
      if ((!amount && amount !== 0) || !date || !description) return res.status(400).json({ error: 'amount, date, description required' });
      if (isNaN(Number(amount)) || Number(amount) < 0) return res.status(400).json({ error: 'Valid amount required' });
      await query('INSERT INTO expenses (salon_id, description, amount, category, date) VALUES (?, ?, ?, ?, ?)', [req.salonId, description, Number(amount), category || null, date]);
      res.json({ success: true }); }
    catch (e: any) { console.error(e); res.status(500).json({ error: 'Failed' }); }
  });

  app.delete('/api/salon/expenses/:id', salonAuth, async (req: any, res) => {
    try { await query('DELETE FROM expenses WHERE id = ? AND salon_id = ?', [req.params.id, req.salonId]); res.json({ success: true }); }
    catch (e: any) { console.error(e); res.status(500).json({ error: 'Failed' }); }
  });

  app.put('/api/salon/expenses/:id', salonAuth, async (req: any, res) => {
    try {
      if (req.body.amount !== undefined && (isNaN(Number(req.body.amount)) || Number(req.body.amount) < 0)) return res.status(400).json({ error: 'Valid amount required' });
      if (req.body.date !== undefined && !req.body.date) return res.status(400).json({ error: 'Valid date required' });
      await updateExpense(Number(req.params.id), req.body); res.json({ success: true }); }
    catch (e: any) { console.error(e); res.status(500).json({ error: 'Failed' }); }
  });

  // ─── Notification Preferences ────────────────────────────────────
  app.get('/api/salon/notification-preferences', salonAuth, async (req: any, res) => {
    try {
      const rows: any = await query('SELECT * FROM notification_preferences WHERE salon_id = ?', [req.salonId]);
      if (rows.length === 0) {
        // Create defaults
        await query(
          'INSERT INTO notification_preferences (salon_id) VALUES (?)',
          [req.salonId]
        );
        return res.json({ reminder_30min: true, queue_update: true, review_request: true, re_engagement: true });
      }
      const { id, salon_id, reminder_30min, queue_update, review_request, re_engagement } = rows[0];
      res.json({ reminder_30min: !!reminder_30min, queue_update: !!queue_update, review_request: !!review_request, re_engagement: !!re_engagement });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch preferences' });
    }
  });

  app.put('/api/salon/notification-preferences', salonAuth, async (req: any, res) => {
    try {
      const { reminder_30min, queue_update, review_request, re_engagement } = req.body;
      await query(
        `INSERT INTO notification_preferences (salon_id, reminder_30min, queue_update, review_request, re_engagement)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE reminder_30min=?, queue_update=?, review_request=?, re_engagement=?`,
        [req.salonId, reminder_30min !== false, queue_update !== false, review_request !== false, re_engagement !== false,
         reminder_30min !== false, queue_update !== false, review_request !== false, re_engagement !== false]
      );
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update preferences' });
    }
  });

  app.get('/api/salon/notifications', salonAuth, async (req: any, res) => {
    try {
      const rows: any = await query(
        'SELECT * FROM notification_preferences WHERE salon_id = ?',
        [req.salonId]
      );
      if (rows.length > 0) {
        res.json(rows[0]);
      } else {
        res.json({ reminder_30min: true, queue_update: true, review_request: true, re_engagement: true });
      }
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  app.get('/api/salon/notification-logs', salonAuth, async (req: any, res) => {
    try {
      const rows = await query(
        'SELECT * FROM notification_logs WHERE salon_id = ? ORDER BY sent_at DESC LIMIT 100',
        [req.salonId]
      );
      res.json(rows);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch notification logs' });
    }
  });

  app.post('/api/salon/notifications/reminders', salonAuth, async (req: any, res) => {
    try {
      const { reminder_30min, queue_update, review_request, re_engagement } = req.body;
      await query(
        `INSERT INTO notification_preferences (salon_id, reminder_30min, queue_update, review_request, re_engagement)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE reminder_30min=VALUES(reminder_30min), queue_update=VALUES(queue_update), review_request=VALUES(review_request), re_engagement=VALUES(re_engagement)`,
        [req.salonId, reminder_30min !== false, queue_update !== false, review_request !== false, re_engagement !== false]
      );
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update notification preferences' });
    }
  });

  // ─── Salon Media / Gallery ──────────────────────────────────────
  app.get('/api/salon/media', salonAuth, async (req: any, res) => {
    try {
      const rows = await query('SELECT * FROM salon_media WHERE salon_id = ? ORDER BY is_cover DESC, display_order DESC, created_at DESC', [req.salonId]);
      res.json(rows);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch media' });
    }
  });

  app.post('/api/salon/media', salonAuth, async (req: any, res) => {
    try {
      const { media_url, media_type, title, description } = req.body;
      if (!media_url) return res.status(400).json({ error: 'media_url is required' });
      const result = await upsertSalonMedia({
        salon_id: req.salonId,
        media_url,
        media_type: media_type || 'image',
        title: title || '',
        description: description || '',
        display_order: 0,
        is_cover: false
      });
      res.json({ success: true, id: result.insertId });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to add media' });
    }
  });

  app.post('/api/salon/media/upload', salonAuth, (req: SalonRequest, res: express.Response, next: express.NextFunction) => {
    upload.single('image')(req, res, (err: any) => {
      if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
      next();
    });
  }, async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Image file required' });
      const mediaUrl = '/uploads/' + req.file.filename;
      const result = await upsertSalonMedia({
        salon_id: req.salonId,
        media_url: mediaUrl,
        media_type: 'image',
        title: req.body.title || '',
        description: req.body.description || '',
        display_order: 0,
        is_cover: false
      });
      res.json({ success: true, id: result.insertId, url: mediaUrl });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Upload failed: ' + e.message });
    }
  });

  app.put('/api/salon/media/:id', salonAuth, async (req: any, res) => {
    try {
      const mediaId = parseId(req.params.id);
      if (mediaId === null) return res.status(400).json({ error: 'Invalid media ID' });
      const { title, description } = req.body;
      const mediaRows: any = await query('SELECT id FROM salon_media WHERE id = ? AND salon_id = ?', [mediaId, req.salonId]);
      if (mediaRows.length === 0) return res.status(404).json({ error: 'Media not found' });
      await query('UPDATE salon_media SET title = ?, description = ? WHERE id = ? AND salon_id = ?', [title || '', description || '', mediaId, req.salonId]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update media' });
    }
  });

  app.delete('/api/salon/media/:id', salonAuth, async (req: any, res) => {
    try {
      const mediaId = parseId(req.params.id);
      if (mediaId === null) return res.status(400).json({ error: 'Invalid media ID' });
      const mediaRows: any = await query('SELECT id FROM salon_media WHERE id = ? AND salon_id = ?', [mediaId, req.salonId]);
      if (mediaRows.length === 0) return res.status(404).json({ error: 'Media not found' });
      await deleteSalonMedia(mediaId);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete media' });
    }
  });

  app.put('/api/salon/media/:id/cover', salonAuth, async (req: any, res) => {
    try {
      const mediaId = parseId(req.params.id);
      if (mediaId === null) return res.status(400).json({ error: 'Invalid media ID' });
      await setSalonCoverImage(req.salonId, mediaId);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to set cover' });
    }
  });

  // ─── Barber Image Upload ────────────────────────────────────────
  app.post('/api/salon/barbers/:id/image', salonAuth, (req: SalonRequest, res: express.Response, next: express.NextFunction) => {
    upload.single('image')(req, res, (err: any) => {
      if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
      next();
    });
  }, async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Image file required' });
      const barberCheck = await query('SELECT id FROM barbers WHERE id = ? AND salon_id = ?', [req.params.id, req.salonId]);
      if (barberCheck.length === 0) return res.status(404).json({ error: 'Barber not found' });
      const mediaUrl = '/uploads/' + req.file.filename;
      await query('UPDATE barbers SET profile_image = ? WHERE id = ?', [mediaUrl, req.params.id]);
      res.json({ success: true, url: mediaUrl });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Image upload failed' });
    }
  });

  // ─── Walk-in Entry ──────────────────────────────────────────────
  app.post('/api/salon/walkin', salonAuth, async (req: any, res) => {
    try {
      const { phone, name, service_id, barber_id, appointment_date, appointment_time } = req.body;
      if (!phone || !service_id || !appointment_date || !appointment_time) {
        return res.status(400).json({ error: 'phone, service_id, appointment_date, appointment_time are required' });
      }
      // Get service duration
      const svc: any = await query('SELECT duration, price FROM services WHERE id = ? AND salon_id = ?', [service_id, req.salonId]);
      if (svc.length === 0) return res.status(400).json({ error: 'Service not found' });
      const duration = svc[0].duration || 30;
      // Calculate end_time
      const [h, m] = appointment_time.split(':').map(Number);
      const d = new Date(); d.setHours(h, m + duration, 0, 0);
      const end_time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      // Generate token
      const token = generateToken();
      // Upsert customer
      const customerName = name || 'Walk-in';
      await query('INSERT INTO customers (phone, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = ?', [phone, customerName, customerName]);
      // Create appointment
      let assignedBarber = null;
      if (barber_id) {
        const bCheck: any = await query('SELECT id FROM barbers WHERE id = ? AND salon_id = ?', [barber_id, req.salonId]);
        if (bCheck.length > 0) assignedBarber = barber_id;
      }
      if (!assignedBarber) {
        const barbers: any = await getBarbersBySalon(req.salonId);
        if (barbers.length > 0) assignedBarber = barbers[0].id;
      }
      await query(
        `INSERT INTO appointments (salon_id, barber_id, customer_phone, customer_name, service_id, appointment_date, appointment_time, end_time, token, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
        [req.salonId, assignedBarber, phone, customerName, service_id, appointment_date, appointment_time, end_time, token]
      );
      res.json({ success: true, token, end_time, barber_id: assignedBarber });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Walk-in failed: ' + e.message });
    }
  });

  app.get('/api/salon/walkins', salonAuth, async (req: any, res) => {
    try {
      const rows = await getWalkins(req.salonId);
      res.json(rows);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch walk-ins' });
    }
  });

  app.put('/api/salon/walkins/:id', salonAuth, async (req: any, res) => {
    try {
      await updateWalkin(Number(req.params.id), req.salonId, req.body);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update walk-in' });
    }
  });

  app.delete('/api/salon/walkins/:id', salonAuth, async (req: any, res) => {
    try {
      await deleteWalkin(Number(req.params.id), req.salonId);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete walk-in' });
    }
  });

  // ─── Barber Attendance ──────────────────────────────────────────
  // GET /api/salon/barbers to view barbers with their PINs (already exists)
  // We reuse that, but add PIN in the response

  // POST /api/salon/attendance/clockin — { barber_id, pin_code }
  app.post('/api/salon/attendance/clockin', salonAuth, async (req: any, res) => {
    try {
      const { barber_id, pin_code } = req.body;
      if (!barber_id || !pin_code) return res.status(400).json({ error: 'barber_id and pin_code required' });
      const result = await clockInBarber(barber_id, req.salonId, pin_code, 'portal');
      if (!result.success) return res.status(400).json({ error: result.error });
      res.json({ success: true, message: 'Clocked in!' });
    } catch (e: any) { console.error('[Salon Route Error]', e?.message || e); res.status(500).json({ error: 'Internal server error' }); }
  });

  // POST /api/salon/attendance/clockout — { barber_id, pin_code }
  app.post('/api/salon/attendance/clockout', salonAuth, async (req: any, res) => {
    try {
      const { barber_id, pin_code } = req.body;
      if (!barber_id || !pin_code) return res.status(400).json({ error: 'barber_id and pin_code required' });
      const result = await clockOutBarber(barber_id, req.salonId, pin_code);
      if (!result.success) return res.status(400).json({ error: result.error });
      res.json({ success: true, message: 'Clocked out!' });
    } catch (e: any) { console.error('[Salon Route Error]', e?.message || e); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /api/salon/attendance/today — view today's attendance
  app.get('/api/salon/attendance/today', salonAuth, async (req: any, res) => {
    try {
      const rows = await getTodayAttendance(req.salonId);
      res.json(rows);
    } catch (e: any) { console.error('[Salon Route Error]', e?.message || e); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /api/salon/attendance/history?days=30
  app.get('/api/salon/attendance/history', salonAuth, async (req: any, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const rows = await getAttendanceHistory(req.salonId, days);
      res.json(rows);
    } catch (e: any) { console.error('[Salon Route Error]', e?.message || e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.put('/api/salon/attendance/:id', salonAuth, async (req: any, res) => {
    try {
      await updateAttendance(Number(req.params.id), req.body);
      res.json({ success: true });
    } catch (e: any) { console.error('[Salon Route Error]', e?.message || e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.delete('/api/salon/attendance/:id', salonAuth, async (req: any, res) => {
    try {
      await deleteAttendance(Number(req.params.id));
      res.json({ success: true });
    } catch (e: any) { console.error('[Salon Route Error]', e?.message || e); res.status(500).json({ error: 'Internal server error' }); }
  });

  // Barber PIN auto-generate on create (update existing POST /api/salon/barbers)
  // Also add endpoint to set/reset PIN
  app.post('/api/salon/barbers/:id/pin', salonAuth, async (req: any, res) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) return res.status(400).json({ error: 'Invalid barber ID' });
      const { pin_code } = req.body;
      if (!pin_code || !/^\d{4}$/.test(pin_code)) return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
      const pinHash = hashPin(pin_code);
      await query('UPDATE barbers SET pin_code = ? WHERE id = ? AND salon_id = ?', [pinHash, id, req.salonId]);
      res.json({ success: true });
    } catch (e: any) { console.error('[Salon Route Error]', e?.message || e); res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Salon WhatsApp Session Management ────────────────────────────
  app.get('/api/salon/whatsapp/status', salonAuth, async (req: any, res) => {
    try {
      const sessionId = `salon-${req.salonId}`;
      const session = sessions ? sessions.get(sessionId) : null;
      res.json({
        sessionId,
        connected: session?.status === 'CONNECTED',
        status: session?.status || 'DISCONNECTED',
        qr: session?.status === 'QR_READY' ? session.qr : null,
        user: session?.user || null
      });
    } catch (e: any) { console.error('[Salon WhatsApp Status Error]', e?.message || e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post('/api/salon/whatsapp/init', salonAuth, async (req: any, res) => {
    try {
      const sessionId = `salon-${req.salonId}`;
      if (connectingSessions?.has(sessionId)) {
        return res.json({ success: true, message: 'Already initializing' });
      }
      if (connectToWhatsApp) {
        connectToWhatsApp(sessionId).catch((err: any) => {
          console.error(`[Salon WhatsApp] Init failed for ${sessionId}:`, err?.message || err);
        });
      }
      res.json({ success: true, message: 'WhatsApp session initializing' });
    } catch (e: any) { console.error('[Salon WhatsApp Init Error]', e?.message || e); res.status(500).json({ error: 'Internal server error' }); }
  });

app.post('/api/salon/whatsapp/restart', salonAuth, async (req: any, res) => {
     try {
       const sessionId = `salon-${req.salonId}`;
       if (cleanupSession) cleanupSession(sessionId);
       if (sessions) sessions.delete(sessionId);
       if (connectingSessions) connectingSessions.delete(sessionId);

       const authPath = path.join(process.cwd(), `auth-info-${sessionId}`);
       const fs = await import('fs');
       if (fs.existsSync(authPath)) { fs.rmSync(authPath, { recursive: true, force: true }); }

       if (io) io.emit('session-status', { sessionId, status: 'DISCONNECTED', message: 'Restarting...' });
       setTimeout(() => {
         if (connectToWhatsApp) {
           connectToWhatsApp(sessionId).catch((err: any) => {
             console.error(`[Salon WhatsApp] Restart failed:`, err?.message || err);
           });
         }
       }, 1000);
       res.json({ success: true, message: 'Session restarting' });
     } catch (e: any) { console.error('[Salon WhatsApp Restart Error]', e?.message || e); res.status(500).json({ error: 'Internal server error' }); }
   });

   // ─── WhatsApp Regenerate (Disconnect + New QR) ───────────────────────────
   app.post('/api/salon/whatsapp/regenerate', salonAuth, async (req: any, res) => {
     try {
       const { sessionId } = req.body;
       const expectedId = `salon-${req.salonId}`;
       if (!sessionId || sessionId !== expectedId) {
         return res.status(400).json({ error: 'Invalid session ID' });
       }
       if (cleanupSession) cleanupSession(sessionId);
       if (sessions) sessions.delete(sessionId);
       if (connectingSessions) connectingSessions.delete(sessionId);

       const authPath = path.join(process.cwd(), `auth-info-${sessionId}`);
       const fs = await import('fs');
       if (fs.existsSync(authPath)) { fs.rmSync(authPath, { recursive: true, force: true }); }

       if (io) io.to(`session-${sessionId}`).emit('session-status', { sessionId, status: 'DISCONNECTED', message: 'Ready to connect...' });
       setTimeout(() => {
         if (connectToWhatsApp) {
           connectToWhatsApp(sessionId).catch((err: any) => {
             console.error(`[Salon WhatsApp] Regenerate failed:`, err?.message || err);
           });
         }
       }, 500);
       res.json({ success: true, message: 'QR will be generated - scan to connect your number' });
     } catch (e: any) { console.error('[Salon WhatsApp Regenerate Error]', e?.message || e); res.status(500).json({ error: 'Internal server error' }); }
   });

   app.delete('/api/salon/whatsapp', salonAuth, async (req: any, res) => {
    try {
      const sessionId = `salon-${req.salonId}`;
      if (cleanupSession) cleanupSession(sessionId);
      if (sessions) sessions.delete(sessionId);

      const authPath = path.join(process.cwd(), `auth-info-${sessionId}`);
      const fs = await import('fs');
      if (fs.existsSync(authPath)) { fs.rmSync(authPath, { recursive: true, force: true }); }

      if (io) io.emit('session-status', { sessionId, status: 'DISCONNECTED', message: 'Deleted' });
      res.json({ success: true, message: 'WhatsApp session deleted' });
    } catch (e: any) { console.error('[Salon WhatsApp Delete Error]', e?.message || e); res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Day Offs ──────────────────────────────────────────────────────
  app.get('/api/salon/day-offs', salonAuth, async (req: any, res) => {
    try {
      const rows = await query('SELECT * FROM day_offs WHERE salon_id = ? AND is_active = TRUE ORDER BY date DESC', [req.salonId]);
      res.json(rows);
    } catch (e: any) { console.error('[DayOff Error]', e?.message || e); res.status(500).json({ error: 'Failed to fetch day offs' }); }
  });

  app.post('/api/salon/day-offs', salonAuth, async (req: any, res) => {
    try {
      const { date, reason } = req.body;
      if (!date) return res.status(400).json({ error: 'Date is required' });
      await query('INSERT INTO day_offs (salon_id, date, reason, is_active) VALUES (?, ?, ?, 1)', [req.salonId, date, reason || '']);
      res.json({ success: true });
    } catch (e: any) { console.error('[DayOff Error]', e?.message || e); res.status(500).json({ error: 'Failed to add day off' }); }
  });

  app.delete('/api/salon/day-offs/:id', salonAuth, async (req: any, res) => {
    try {
      await query('DELETE FROM day_offs WHERE id = ? AND salon_id = ?', [req.params.id, req.salonId]);
      res.json({ success: true });
    } catch (e: any) { console.error('[DayOff Error]', e?.message || e); res.status(500).json({ error: 'Failed to remove day off' }); }
  });

  // ─── Database Reset ────────────────────────────────────────────────
  app.post('/api/salon/database/reset', salonAuth, async (req: any, res) => {
    try {
      if (req.body.confirm !== 'RESET_SALON_DATA') {
        return res.status(400).json({ error: 'Please send { confirm: "RESET_SALON_DATA" } to confirm.' });
      }
      const sid = req.salonId;
      const tablesToClear = [
        'notification_logs', 'sent_notifications',
        'barber_attendance', 'reviews', 'appointments',
        'revenue', 'expenses'
      ];

      await beginTransaction();
      for (const table of tablesToClear) {
        try { await query(`DELETE FROM \`${table}\` WHERE salon_id = ?`, [sid]); } catch (_) {}
      }
      await commit();

      res.json({ success: true, message: 'Salon data reset completed.' });
    } catch (e: any) {
      await rollback().catch(() => {});
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Database reset failed: ' + e.message });
    }
  });
}
