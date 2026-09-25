import express from 'express';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, verifyAccessToken } from './auth-helper';
import { query, paginatedQuery, getChatContacts, getChatMessages, saveChatMessage, getCustomerByPhone, getAdminByEmail, getAllAdmins, createAdmin, updateAdmin, deleteAdmin, updateAdminLogin, updateAdmin2FA, disableAdmin2FA, createAuditLog, getAuditLogs, getAuditLogsCount, getAutomationRules, createAutomationRule, updateAutomationRule, deleteAutomationRule, getAllSettings, upsertSetting, deleteSetting, getPayouts, createPayout, updatePayoutStatus, getDisputes, createDispute, updateDisputeStatus, getCoupons, createCoupon, updateCoupon, deleteCoupon, updateCountry, deleteCountry, deleteCity, deleteArea, deleteSalonCascade, beginTransaction, commit, rollback, getTodayAttendance, getAttendanceHistory, updateAttendance, deleteAttendance, updateCity, updateArea, getPendingBookings, flushPendingBookings, deletePendingBooking } from './db';
import { isWAConnected, getWASocket } from './notification-service';
import { validatePassword, sanitizeString, parseId } from './security';
import { generateToken, normalizePhone } from './utils';
import { adminAuth, superAdminAuth, checkSalonAccess, requireWriteAccess, requireAdminOrSuperAdmin, AdminRequest } from './middleware';

export function setupAdminRoutes(app: express.Application, context?: any) {
  const { sessions, connectToWhatsApp, connectingSessions, io, cleanupSession } = context || {};

  // ─── Admin Auth ────────────────────────────────────────────────────
  const loginAttempts = new Map<string, { count: number, blockedUntil: number }>();
  const twofaAttempts = new Map<string, { count: number, blockedUntil: number }>();

  app.post('/api/admin/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

      const key = email.toLowerCase();
      const now = Date.now();
      const attempt = loginAttempts.get(key);
      if (attempt && attempt.blockedUntil > now) {
        const remaining = Math.ceil((attempt.blockedUntil - now) / 60000);
        return res.status(429).json({ error: `Too many attempts. Try again in ${remaining} minute(s)` });
      }

      const admin = await getAdminByEmail(email);
      if (!admin) {
        const prev = loginAttempts.get(key) || { count: 0, blockedUntil: 0 };
        prev.count++;
        if (prev.count >= 5) { prev.blockedUntil = now + 15 * 60 * 1000; prev.count = 0; }
        loginAttempts.set(key, prev);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      if (!admin.is_active) return res.status(403).json({ error: 'Account is disabled' });
      if (!(await bcrypt.compare(password, admin.password || ''))) {
        const prev = loginAttempts.get(key) || { count: 0, blockedUntil: 0 };
        prev.count++;
        if (prev.count >= 5) { prev.blockedUntil = now + 15 * 60 * 1000; prev.count = 0; }
        loginAttempts.set(key, prev);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      loginAttempts.delete(key);

      if ((admin as any).twofa_enabled) {
        const tempToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        await query('INSERT INTO admin_2fa_tokens (temp_token, admin_id, email, expires_at) VALUES (?, ?, ?, ?)', [tempToken, admin.id, email, expiresAt]);
        return res.json({ twofa_required: true, tempToken, adminId: admin.id });
      }

      const accessToken = generateAccessToken({ role: admin.role, email, id: admin.id });
      const refreshToken = generateRefreshToken({ role: admin.role, email, id: admin.id });
      await updateAdminLogin(admin.id);
      res.json({ token: accessToken, refreshToken, admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } });
    } catch (e: any) {
      console.error('[Admin Login Error]', e?.message || e, e?.stack);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.get('/api/admin/auth/me', adminAuth, async (req: any, res) => {
    const decoded = verifyAccessToken(req.headers.authorization.split(' ')[1]);
    if (!decoded) return res.status(401).json({ error: 'Invalid token' });
    const admin = await getAdminByEmail(decoded.email!);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    res.json({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, twofa_enabled: !!(admin as any).twofa_enabled });
  });

  app.post('/api/admin/auth/refresh', async (req, res) => {
    try {
      const { refreshToken: incomingRefreshToken } = req.body;
      if (!incomingRefreshToken) return res.status(400).json({ error: 'Refresh token required' });
      const decoded = verifyRefreshToken(incomingRefreshToken);
      if (!decoded) return res.status(401).json({ error: 'Invalid or expired refresh token' });
      const accessToken = generateAccessToken({ role: decoded.role, email: decoded.email, id: decoded.id });
      const refreshToken = generateRefreshToken({ role: decoded.role, email: decoded.email, id: decoded.id });
      res.json({ token: accessToken, refreshToken });
    } catch (e: any) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
  });

  // ─── 2FA Verify ─────────────────────────────────────────────────────
  app.post('/api/admin/auth/2fa/verify', async (req, res) => {
    try {
      const { tempToken, code } = req.body;
      if (!tempToken || !code) return res.status(400).json({ error: 'tempToken and code required' });
      const now = Date.now();
      const attempt = twofaAttempts.get(tempToken) || { count: 0, blockedUntil: 0 };
      if (attempt.blockedUntil > now) {
        const remaining = Math.ceil((attempt.blockedUntil - now) / 1000);
        return res.status(429).json({ error: `Too many attempts. Try again in ${remaining} second(s)` });
      }
      attempt.count++;
      if (attempt.count >= 5) {
        attempt.blockedUntil = now + 15 * 60 * 1000;
        attempt.count = 0;
      }
      twofaAttempts.set(tempToken, attempt);

      const rows: any = await query('SELECT * FROM admin_2fa_tokens WHERE temp_token = ? AND expires_at > NOW()', [tempToken]);
      if (rows.length === 0) return res.status(401).json({ error: 'Invalid or expired temp token' });

      const tokenData = rows[0];
      const admin = await getAdminByEmail(tokenData.email);
      if (!admin) return res.status(404).json({ error: 'Admin not found' });

      if (!(await bcrypt.compare(code, (admin as any).twofa_code || ''))) return res.status(401).json({ error: 'Invalid 2FA code' });

      await query('DELETE FROM admin_2fa_tokens WHERE temp_token = ?', [tempToken]);

      const accessToken = generateAccessToken({ role: admin.role, email: admin.email, id: admin.id });
      const refreshToken = generateRefreshToken({ role: admin.role, email: admin.email, id: admin.id });
      await updateAdminLogin(admin.id);
      res.json({ token: accessToken, refreshToken, admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } });
    } catch (e: any) {
      console.error('[2FA Verify Error]', e?.message || e);
      res.status(500).json({ error: '2FA verification failed' });
    }
  });

  // ─── 2FA Enable ─────────────────────────────────────────────────────
  app.post('/api/admin/auth/2fa/enable', adminAuth, async (req: any, res) => {
    try {
      const { code } = req.body;
      if (!code || code.length < 4) return res.status(400).json({ error: '2FA code must be at least 4 characters' });
      await updateAdmin2FA(req.adminId, code);
      await createAuditLog({ admin_id: req.adminId, action: 'ENABLE_2FA', entity_type: 'admin', entity_id: String(req.adminId), details: 'Enabled 2FA authentication' });
      res.json({ success: true, message: '2FA enabled successfully' });
    } catch (e: any) {
      console.error('[2FA Enable Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to enable 2FA' });
    }
  });

  // ─── 2FA Disable ────────────────────────────────────────────────────
  app.post('/api/admin/auth/2fa/disable', adminAuth, async (req: any, res) => {
    try {
      const { code } = req.body;
      const rows: any = await query('SELECT twofa_code FROM admins WHERE id = ?', [req.adminId]);
      const storedCode = rows[0]?.twofa_code;
      if (storedCode && !(await bcrypt.compare(code, storedCode))) {
        return res.status(401).json({ error: 'Invalid 2FA code' });
      }
      await disableAdmin2FA(req.adminId);
      await createAuditLog({ admin_id: req.adminId, action: 'DISABLE_2FA', entity_type: 'admin', entity_id: String(req.adminId), details: 'Disabled 2FA authentication' });
      res.json({ success: true, message: '2FA disabled successfully' });
    } catch (e: any) {
      console.error('[2FA Disable Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to disable 2FA' });
    }
  });

  // ─── Platform Stats ────────────────────────────────────────────────
  const statsCache = new Map<string, { data: any; expiry: number }>();
  const STATS_CACHE_TTL = 60_000;

  app.get('/api/admin/stats', adminAuth, async (req: any, res) => {
    try {
      const isSuperAdmin = req.adminRole === 'super_admin';
      const adminId = req.adminId;
      const querySalonId = req.query.salon_id ? Number(req.query.salon_id) : null;
      const cacheKey = `stats_${adminId}_${querySalonId || 'all'}`;
      const cached = statsCache.get(cacheKey);
      if (cached && cached.expiry > Date.now()) return res.json(cached.data);

      let salonFilter = '';
      const salonParams: any[] = [];
      if (!isSuperAdmin) { salonFilter += ' AND s.assigned_admin_id = ?'; salonParams.push(adminId); }
      if (querySalonId) { salonFilter += ' AND s.id = ?'; salonParams.push(querySalonId); }

      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];

      const [
        salons, activeSalons, barbers, customers, appointments, completed, revenue,
        countries, cities, areas, topSalons, trend, totalCustomersCount, customersToday
      ] = await Promise.all([
        query(`SELECT COUNT(*) as total FROM salons s WHERE 1=1${salonFilter}`, salonParams),
        query(`SELECT COUNT(*) as total FROM salons s WHERE status = 'active'${salonFilter}`, salonParams),
        query(
          `SELECT COUNT(*) as total FROM barbers b JOIN salons s ON b.salon_id = s.id WHERE b.status = 'active'${salonFilter}`,
          salonParams
        ),
        query(
          `SELECT COUNT(DISTINCT a.customer_phone) as total FROM appointments a JOIN salons s ON a.salon_id = s.id WHERE 1=1${salonFilter}`,
          salonParams
        ),
        query(
          `SELECT COUNT(*) as total FROM appointments a JOIN salons s ON a.salon_id = s.id WHERE 1=1${salonFilter}`,
          salonParams
        ),
        query(
          `SELECT COUNT(*) as total FROM appointments a JOIN salons s ON a.salon_id = s.id WHERE a.status = 'completed'${salonFilter}`,
          salonParams
        ),
        query(
          `SELECT COALESCE(SUM(srv.price), 0) as total FROM appointments a JOIN services srv ON a.service_id = srv.id JOIN salons s ON a.salon_id = s.id WHERE a.status = 'completed'${salonFilter}`,
          salonParams
        ),
        query('SELECT COUNT(*) as total FROM countries WHERE is_active = 1'),
        query('SELECT COUNT(*) as total FROM cities WHERE is_active = 1'),
        query('SELECT COUNT(*) as total FROM areas WHERE is_active = 1'),
        query(
          `SELECT s.name, s.email, s.status, COUNT(a.id) as bookings, COALESCE(SUM(srv.price), 0) as revenue
           FROM salons s LEFT JOIN appointments a ON s.id = a.salon_id AND a.status = 'completed'
           LEFT JOIN services srv ON a.service_id = srv.id
           WHERE 1=1${salonFilter}
           GROUP BY s.id ORDER BY bookings DESC LIMIT 10`,
          salonParams
        ),
        query(
          `SELECT a.appointment_date as date, COUNT(*) as bookings
           FROM appointments a JOIN salons s ON a.salon_id = s.id
           WHERE a.appointment_date >= ?${salonFilter}
           GROUP BY a.appointment_date ORDER BY date`,
          [thirtyDaysAgo, ...salonParams]
        ),
        query(
          `SELECT COUNT(DISTINCT customer_phone) as total FROM appointments a JOIN salons s ON a.salon_id = s.id WHERE 1=1${salonFilter}`,
          salonParams
        ),
        query(
          `SELECT COUNT(DISTINCT customer_phone) as total FROM appointments a JOIN salons s ON a.salon_id = s.id WHERE a.appointment_date = ?${salonFilter}`,
          [todayStr, ...salonParams]
        ),
      ]);

      const responseData = {
        totalSalons: salons[0]?.total || 0,
        activeSalons: activeSalons[0]?.total || 0,
        totalBarbers: barbers[0]?.total || 0,
        totalCustomers: customers[0]?.total || 0,
        totalAppointments: appointments[0]?.total || 0,
        completedAppointments: completed[0]?.total || 0,
        totalRevenue: revenue[0]?.total || 0,
        countries: countries[0]?.total || 0,
        cities: cities[0]?.total || 0,
        areas: areas[0]?.total || 0,
        totalVisits: totalCustomersCount[0]?.total || 0,
        visitsToday: customersToday[0]?.total || 0,
        conversionRate: 0,
        topSalons,
        bookingTrend: trend
      };
      statsCache.set(cacheKey, { data: responseData, expiry: Date.now() + STATS_CACHE_TTL });
      res.json(responseData);
    } catch (e: any) {
      console.error('Admin stats error:', e);
      res.status(500).json({ error: 'Failed to load stats' });
    }
  });

  app.get('/api/admin/leads', adminAuth, async (req: any, res) => {
    try {
      const isSuperAdmin = req.adminRole === 'super_admin';
      const adminId = req.adminId;
      let sql = `SELECT a.*, c.name as customer_name, sl.name as salon_name, b.name as barber_name
         FROM appointments a
         LEFT JOIN customers c ON a.customer_phone = c.phone
         JOIN salons sl ON a.salon_id = sl.id
         LEFT JOIN barbers b ON a.barber_id = b.id`;
      const params: any[] = [];
      if (!isSuperAdmin) {
        sql += ' WHERE sl.assigned_admin_id = ?';
        params.push(adminId);
      }
      sql += ' ORDER BY a.created_at DESC LIMIT 100';
      const rows: any = await query(sql, params);
      res.json(rows);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch leads' });
    }
  });

  // ─── Countries CRUD ────────────────────────────────────────────────
  app.get('/api/admin/locations/countries', adminAuth, async (req, res) => {
    try {
      const rows: any = await query('SELECT * FROM countries ORDER BY name');
      res.json(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch countries' });
    }
  });

  app.post('/api/admin/locations/countries', adminAuth, requireWriteAccess as any, async (req, res) => {
    try {
      const { name, phone_code, is_active } = req.body;
      if (!name) return res.status(400).json({ error: 'Name required' });
      const r: any = await query('INSERT INTO countries (name, phone_code, is_active) VALUES (?,?,?)',
        [sanitizeString(name), sanitizeString(phone_code || ''), is_active ? 1 : 0]);
      const rows: any = await query('SELECT * FROM countries WHERE id = ?', [r.insertId]);
      res.json(rows[0]);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to create country' });
    }
  });

app.put('/api/admin/locations/countries/:id', adminAuth, requireWriteAccess as any, async (req, res) => {
     try {
       const { name, phone_code, is_active } = req.body;
        await updateCountry(Number(req.params.id), { name: sanitizeString(name), phone_code: sanitizeString(phone_code || ''), is_active });
       const rows: any = await query('SELECT * FROM countries WHERE id = ?', [req.params.id]);
       res.json(rows[0]);
     } catch (e: any) {
       console.error('[Admin Route Error]', e?.message || e);
       res.status(500).json({ error: 'Failed to update country' });
     }
   });

  app.delete('/api/admin/locations/countries/:id', adminAuth, requireWriteAccess as any, async (req, res) => {
    try {
      await query('DELETE FROM areas WHERE city_id IN (SELECT id FROM cities WHERE country_id = ?)', [req.params.id]);
      await query('DELETE FROM cities WHERE country_id = ?', [req.params.id]);
      await query('DELETE FROM countries WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete country' });
    }
  });

  // ─── Cities CRUD ──────────────────────────────────────────────────
  app.get('/api/admin/locations/cities/:countryId', adminAuth, async (req, res) => {
    try {
      const rows: any = await query('SELECT * FROM cities WHERE country_id = ? ORDER BY name', [req.params.countryId]);
      res.json(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch cities' });
    }
  });

   app.post('/api/admin/locations/cities', adminAuth, requireWriteAccess as any, async (req, res) => {
     try {
       const { country_id, name, is_active } = req.body;
       if (!country_id || !name) return res.status(400).json({ error: 'country_id and name are required' });
        const r: any = await query('INSERT INTO cities (country_id, name, is_active) VALUES (?,?,?)',
          [country_id, sanitizeString(name), is_active ? 1 : 0]);
       const rows: any = await query('SELECT * FROM cities WHERE id = ?', [r.insertId]);
       res.json(rows[0]);
     } catch (e: any) {
       console.error('[Admin Route Error]', e?.message || e);
       res.status(500).json({ error: 'Failed to create city' });
     }
   });

   app.put('/api/admin/locations/cities/:id', adminAuth, requireWriteAccess as any, async (req, res) => {
     try {
       const { name, is_active } = req.body;
        await updateCity(Number(req.params.id), { name: sanitizeString(name), is_active });
       const rows: any = await query('SELECT * FROM cities WHERE id = ?', [req.params.id]);
       res.json(rows[0]);
     } catch (e: any) {
       console.error('[Admin Route Error]', e?.message || e);
       res.status(500).json({ error: 'Failed to update city' });
     }
   });

app.delete('/api/admin/locations/cities/:id', adminAuth, requireWriteAccess as any, async (req, res) => {
     try {
       await deleteCity(Number(req.params.id));
       res.json({ success: true });
     } catch (e: any) {
       console.error('[Admin Route Error]', e?.message || e);
       res.status(500).json({ error: 'Failed to delete city' });
     }
   });

    // ─── Areas CRUD ───────────────────────────────────────────────────
    app.get('/api/admin/locations/areas', adminAuth, async (req, res) => {
      res.status(400).json({ error: 'cityId required — use /api/admin/locations/areas/:cityId' });
    });

    app.get('/api/admin/locations/areas/:cityId', adminAuth, async (req, res) => {
      try {
        const cityId = Number(req.params.cityId);
        if (isNaN(cityId)) return res.status(400).json({ error: 'Invalid cityId' });
        const rows: any = await query('SELECT * FROM areas WHERE city_id = ? ORDER BY name', [cityId]);
        res.json(Array.isArray(rows) ? rows : []);
      } catch (e: any) {
        console.error('[Admin Route Error]', e?.message || e);
        res.status(500).json({ error: 'Failed to fetch areas' });
      }
    });

   app.post('/api/admin/locations/areas', adminAuth, requireWriteAccess as any, async (req, res) => {
     try {
       const { city_id, name, is_active } = req.body;
       if (!city_id || !name) return res.status(400).json({ error: 'city_id and name are required' });
    const r: any = await query('INSERT INTO areas (city_id, name, is_active) VALUES (?,?,?)',
      [city_id, sanitizeString(name), is_active ? 1 : 0]);
       const rows: any = await query('SELECT * FROM areas WHERE id = ?', [r.insertId]);
       res.json(rows[0]);
     } catch (e: any) {
       console.error('[Admin Route Error]', e?.message || e);
       res.status(500).json({ error: 'Failed to create area' });
     }
   });

   app.put('/api/admin/locations/areas/:id', adminAuth, requireWriteAccess as any, async (req, res) => {
     try {
       const { name, is_active } = req.body;
        await updateArea(Number(req.params.id), { name: sanitizeString(name), is_active });
       const rows: any = await query('SELECT * FROM areas WHERE id = ?', [req.params.id]);
       res.json(rows[0]);
     } catch (e: any) {
       console.error('[Admin Route Error]', e?.message || e);
       res.status(500).json({ error: 'Failed to update area' });
     }
   });

app.delete('/api/admin/locations/areas/:id', adminAuth, requireWriteAccess as any, async (req, res) => {
     try {
       await deleteArea(Number(req.params.id));
       res.json({ success: true });
     } catch (e: any) {
       console.error('[Admin Route Error]', e?.message || e);
       res.status(500).json({ error: 'Failed to delete area' });
     }
   });

  // ─── Salon Management ─────────────────────────────────────────────
  app.get('/api/admin/salons', adminAuth, async (req: any, res) => {
    try {
      const isSuperAdmin = req.adminRole === 'super_admin';
      const adminId = req.adminId;
      let sql = `SELECT s.id, s.name, s.owner_name, s.phone, s.email, s.country_id, s.city_id, s.area_id,
                s.address, s.description, s.cover_image_url, s.logo_url, s.status,
                s.rating, s.review_count, s.latitude, s.longitude,
                s.commission_rate, s.commission_type, s.created_at, s.assigned_admin_id,
                c.name as country, ct.name as city, a.name as area
         FROM salons s
         LEFT JOIN countries c ON s.country_id = c.id
         LEFT JOIN cities ct ON s.city_id = ct.id
         LEFT JOIN areas a ON s.area_id = a.id`;
      const params: any[] = [];
      const conditions: string[] = [];
      if (!isSuperAdmin) {
        conditions.push('(s.assigned_admin_id = ? OR s.assigned_admin_id IS NULL)');
        params.push(adminId);
      }
      if (req.query.country_id) {
        conditions.push('s.country_id = ?');
        params.push(req.query.country_id);
      }
      if (req.query.city_id) {
        conditions.push('s.city_id = ?');
        params.push(req.query.city_id);
      }
      if (req.query.area_id) {
        conditions.push('s.area_id = ?');
        params.push(req.query.area_id);
      }
      if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
      sql += ' ORDER BY s.created_at DESC';
      const rows: any = await query(sql, params);
      res.json(rows);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch salons' });
    }
  });

app.post('/api/admin/salons', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const { name, owner_name, phone, owner_phone, email, password, country_id, city_id, area_id, address, description } = req.body;
      if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });

      const existingName = await query('SELECT id FROM salons WHERE name = ?', [sanitizeString(name).trim()]);
      if (existingName.length > 0) return res.status(400).json({ error: 'Salon name already exists' });

      if (phone) {
        const existingPhone = await query('SELECT id FROM salons WHERE phone = ?', [sanitizeString(phone || '').trim()]);
        if (existingPhone.length > 0) return res.status(400).json({ error: 'Salon with this phone already exists' });
      }

      const hash = await bcrypt.hash(password, 10);
      const assignedAdminId = req.adminRole === 'super_admin' ? null : req.adminId;
      const r: any = await query(
        `INSERT INTO salons (name, owner_name, phone, email, password, owner_phone, country_id, city_id, area_id, address, description, assigned_admin_id, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'active')`,
        [sanitizeString(name).trim(), sanitizeString(owner_name || ''), sanitizeString(phone || ''), sanitizeString(email), hash, sanitizeString(owner_phone || ''), country_id || null, city_id || null, area_id || null, sanitizeString(address || ''), sanitizeString(description || ''), assignedAdminId]
      );
      const newSalonId = r.insertId;
      await query(
        `INSERT INTO shop_settings (salon_id, company_name, currency, language) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE company_name=VALUES(company_name)`,
        [newSalonId, sanitizeString(name).trim(), 'Rs.', 'Urdu/English']
      );
      for (let day = 0; day < 7; day++) {
        await query('INSERT INTO working_hours (salon_id, day, start_time, end_time, is_open) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE start_time=VALUES(start_time)',
          [newSalonId, day, '09:00', '18:00', 1]);
      }
      await createAuditLog({ admin_id: req.adminId, action: 'CREATE_SALON', entity_type: 'salon', entity_id: String(newSalonId), details: `Created salon ${name} (${email})`, ip_address: req.ip });
      res.json({ success: true, id: newSalonId });
    } catch (e: any) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email already exists' });
      res.status(500).json({ error: 'Failed to create salon' });
    }
  });

  app.put('/api/admin/salons/:id', adminAuth, requireWriteAccess, async (req: any, res) => {
    try {
      if (!(await checkSalonAccess(req, res, Number(req.params.id)))) return;
      const { name, owner_name, phone, owner_phone, email, country_id, city_id, area_id, address, description, assigned_admin_id } = req.body;
      const isSuperAdmin = req.adminRole === 'super_admin';

      if (name) {
        const existingName = await query('SELECT id FROM salons WHERE name = ? AND id != ?', [sanitizeString(name || '').trim(), req.params.id]);
        if (existingName.length > 0) return res.status(400).json({ error: 'Salon name already exists' });
      }

      if (phone) {
        const existingPhone = await query('SELECT id FROM salons WHERE phone = ? AND id != ?', [sanitizeString(phone || '').trim(), req.params.id]);
        if (existingPhone.length > 0) return res.status(400).json({ error: 'Salon with this phone already exists' });
      }

      const assignField = isSuperAdmin ? ', assigned_admin_id=?' : '';
      const assignVal = isSuperAdmin ? [assigned_admin_id || null] : [];
      await query(
        `UPDATE salons SET name=?, owner_name=?, phone=?, owner_phone=?, email=?, country_id=?, city_id=?, area_id=?, address=?, description=?${assignField} WHERE id=?`,
        [sanitizeString(name || ''), sanitizeString(owner_name || ''), sanitizeString(phone || ''), sanitizeString(owner_phone || ''), sanitizeString(email || ''), country_id || null, city_id || null, area_id || null, sanitizeString(address || ''), sanitizeString(description || ''), ...assignVal, req.params.id]
      );
      res.json({ success: true });
    } catch (e: any) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email already exists' });
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update salon' });
    }
  });

  app.put('/api/admin/salons/:id/status', adminAuth, requireAdminOrSuperAdmin, async (req: any, res) => {
    try {
      const { status } = req.body;
      if (!['active', 'inactive', 'pending'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
      const isSuperAdmin = req.adminRole === 'super_admin';
      const adminId = req.adminId;
      const assignCheck = isSuperAdmin ? '' : ' AND assigned_admin_id = ?';
      const params: any[] = [status, req.params.id];
      if (!isSuperAdmin) params.push(adminId);
      const r: any = await query(`UPDATE salons SET status = ? WHERE id = ?${assignCheck}`, params);
      if (r.affectedRows === 0) return res.status(403).json({ error: 'Not authorized or salon not found' });
      await createAuditLog({ admin_id: req.adminId, action: 'CHANGE_SALON_STATUS', entity_type: 'salon', entity_id: String(req.params.id), details: `Changed salon #${req.params.id} status to ${status}`, ip_address: req.ip });
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update status' });
    }
  });

  app.post('/api/admin/salons/:id/reset-password', adminAuth, requireAdminOrSuperAdmin, async (req: any, res) => {
    try {
      const { newPassword } = req.body;
      if (!newPassword) return res.status(400).json({ error: 'newPassword required' });
      const isSuperAdmin = req.adminRole === 'super_admin';
      const adminId = req.adminId;
      const assignCheck = isSuperAdmin ? '' : ' AND assigned_admin_id = ?';
      const hash = await bcrypt.hash(newPassword, 10);
      const params: any[] = [hash, req.params.id];
      if (!isSuperAdmin) params.push(adminId);
      const r: any = await query(`UPDATE salons SET password = ? WHERE id = ?${assignCheck}`, params);
      if (r.affectedRows === 0) return res.status(403).json({ error: 'Not authorized or salon not found' });
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  app.delete('/api/admin/salons/:id', adminAuth, requireAdminOrSuperAdmin, async (req: any, res) => {
    try {
      const isSuperAdmin = req.adminRole === 'super_admin';
      const adminId = req.adminId;
      const assignCheck = isSuperAdmin ? '' : ' AND assigned_admin_id = ?';
      const params: any[] = [req.params.id];
      if (!isSuperAdmin) params.push(adminId);
      const salonId = Number(req.params.id);
      if (isNaN(salonId)) return res.status(400).json({ error: 'Invalid salon ID' });
      await deleteSalonCascade(salonId);
      const r: any = await query(`DELETE FROM salons WHERE id = ?${assignCheck}`, params);
      if (r.affectedRows === 0) return res.status(403).json({ error: 'Not authorized or salon not found' });
      await createAuditLog({ admin_id: req.adminId, action: 'DELETE_SALON', entity_type: 'salon', entity_id: String(salonId), details: `Deleted salon #${salonId}`, ip_address: req.ip });
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete salon' });
    }
  });

  // ─── Admin: All Appointments ────────────────────────────────────────
  app.get('/api/admin/appointments', adminAuth, async (req: any, res) => {
    try {
      const isSuperAdmin = req.adminRole === 'super_admin';
      const adminId = req.adminId;
      const { salon_id, date, date_from, date_to, status, limit: qLimit } = req.query;
      let sql = `SELECT a.*, b.name as barber_name, s.name as service_name, sl.name as salon_name, a.recurring_booking_id, rb.frequency
                 FROM appointments a
                 JOIN barbers b ON a.barber_id = b.id
                 JOIN services s ON a.service_id = s.id
                 JOIN salons sl ON a.salon_id = sl.id
                 LEFT JOIN recurring_bookings rb ON a.recurring_booking_id = rb.id
                 WHERE 1=1`;
      const params: any[] = [];
      if (!isSuperAdmin) { sql += ' AND sl.assigned_admin_id = ?'; params.push(adminId); }
      if (salon_id) { sql += ' AND a.salon_id = ?'; params.push(Number(salon_id)); }
      if (date) { sql += ' AND a.appointment_date = ?'; params.push(date); }
      if (date_from) { sql += ' AND a.appointment_date >= ?'; params.push(date_from); }
      if (date_to) { sql += ' AND a.appointment_date <= ?'; params.push(date_to); }
      if (status) { sql += ' AND a.status = ?'; params.push(status); }
      sql += ' ORDER BY a.created_at DESC';
      if (qLimit) { sql += ' LIMIT ?'; params.push(Number(qLimit)); }
      const rows = await query(sql, params);
      res.json(rows);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch appointments' });
    }
  });

  // ─── Admin: Update Appointment Status ───────────────────────────────
  app.put('/api/admin/appointments/:id/status', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const { status } = req.body;
      if (!['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      const apt: any = await query('SELECT salon_id FROM appointments WHERE id = ?', [req.params.id]);
      if (apt.length === 0) return res.status(404).json({ error: 'Appointment not found' });
      if (!(await checkSalonAccess(req, res, apt[0].salon_id))) return;
      await query('UPDATE appointments SET status = ? WHERE id = ?', [status, req.params.id]);
      await createAuditLog({ admin_id: req.adminId, action: 'UPDATE_APPOINTMENT_STATUS', entity_type: 'appointment', entity_id: String(req.params.id), details: `Updated appointment #${req.params.id} status to ${status}`, ip_address: req.ip });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Admin: Delete Appointment ─────────────────────────────────────
  app.delete('/api/admin/appointments/:id', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const apt: any = await query('SELECT salon_id FROM appointments WHERE id = ?', [req.params.id]);
      if (apt.length === 0) return res.status(404).json({ error: 'Appointment not found' });
      if (!(await checkSalonAccess(req, res, apt[0].salon_id))) return;
      await query('DELETE FROM appointments WHERE id = ?', [req.params.id]);
      await createAuditLog({ admin_id: req.adminId, action: 'DELETE_APPOINTMENT', entity_type: 'appointment', entity_id: String(req.params.id), details: `Deleted appointment #${req.params.id}`, ip_address: req.ip });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Admin: Create Appointment ─────────────────────────────────────
  app.post('/api/admin/appointments', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const { salon_id, barber_id, customer_phone, customer_name, service_id, appointment_date, appointment_time, end_time, status } = req.body;
      if (!salon_id || !customer_phone || !service_id || !appointment_date || !appointment_time) {
        return res.status(400).json({ error: 'salon_id, customer_phone, service_id, appointment_date, appointment_time required' });
      }
      if (!(await checkSalonAccess(req, res, salon_id))) return;
      const token = generateToken();
      const result = await query(
        `INSERT INTO appointments (salon_id, barber_id, customer_phone, customer_name, service_id, appointment_date, appointment_time, end_time, status, token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [salon_id, barber_id || null, sanitizeString(customer_phone || ''), sanitizeString(customer_name || ''), service_id, appointment_date, appointment_time, end_time || null, status || 'confirmed', token]
      );
      res.json({ success: true, id: (result as any).insertId });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Admin: Update Appointment ─────────────────────────────────────
  app.put('/api/admin/appointments/:id', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const apt: any = await query('SELECT salon_id FROM appointments WHERE id = ?', [req.params.id]);
      if (apt.length === 0) return res.status(404).json({ error: 'Appointment not found' });
      if (!(await checkSalonAccess(req, res, apt[0].salon_id))) return;
      const { barber_id, customer_phone, customer_name, service_id, appointment_date, appointment_time, end_time } = req.body;
      await query(
        `UPDATE appointments SET barber_id = ?, customer_phone = ?, customer_name = ?, service_id = ?, appointment_date = ?, appointment_time = ?, end_time = ? WHERE id = ?`,
        [barber_id, sanitizeString(customer_phone || ''), sanitizeString(customer_name || ''), service_id, appointment_date, appointment_time, end_time, req.params.id]
      );
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Admin: All Customers ────────────
  app.get('/api/admin/customers', adminAuth, async (req: any, res) => {
    try {
      const isSuperAdmin = req.adminRole === 'super_admin';
      const adminId = req.adminId;
      const { salon_id, search, page = '1', limit = '20' } = req.query;
      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
      const MAX_FETCH = 500;

      // Simpler approach: fetch from appointments and customers separately, merge in code
      let salonFilter = '';
      const salonParams: any[] = [];
      if (!isSuperAdmin) { salonFilter = ' AND sl.assigned_admin_id = ?'; salonParams.push(adminId); }
      if (salon_id) { salonFilter += ' AND a.salon_id = ?'; salonParams.push(Number(salon_id)); }

      let customers: any[] = [];
      const allPhones = new Set<string>();

      try {
        // Get unique customers from appointments
        const apptCustomers: any = await query(
          `SELECT a.customer_phone, a.customer_name,
                  COUNT(*) as visit_count,
                  MAX(a.appointment_date) as last_visit,
                  sl.name as salon_name,
                  a.salon_id
           FROM appointments a
           JOIN salons sl ON a.salon_id = sl.id
           WHERE 1=1 ${salonFilter}
           GROUP BY a.customer_phone, a.salon_id`,
          salonParams
        );
        if (apptCustomers) {
          for (const c of apptCustomers) {
            customers.push(c);
            allPhones.add(c.customer_phone);
          }
        }
      } catch (_) {}

      try {
        // Get customer names from customers table for unmatched entries
        const unmatchedPhones = customers.filter((c: any) => !c.customer_name).map((c: any) => c.customer_phone);
        if (unmatchedPhones.length > 0) {
          const placeholders = unmatchedPhones.map(() => '?').join(',');
          const nameRows: any = await query(`SELECT phone, name FROM customers WHERE phone IN (${placeholders})`, unmatchedPhones);
          if (nameRows) {
            for (const nr of nameRows) {
              const match = customers.find((c: any) => c.customer_phone === nr.phone);
              if (match) match.customer_name = nr.name || match.customer_phone;
            }
          }
        }
      } catch (_) {}

      // Also get customers directly from the customers table
      try {
        let extraFilter = '';
        if (!isSuperAdmin && salonFilter) {
          extraFilter = ` WHERE phone IN (SELECT DISTINCT customer_phone FROM appointments a JOIN salons s ON a.salon_id = s.id WHERE 1=1${salonFilter})`;
        }
        const dbCustomers: any = await query(
          `SELECT phone as customer_phone, name as customer_name, 0 as visit_count,
                  NULL as last_visit, NULL as salon_name, NULL as salon_id,
                  loyalty_points, status as status_val, last_active
           FROM customers${extraFilter}`
        );
        if (dbCustomers) {
          for (const dc of dbCustomers) {
            if (!allPhones.has(dc.customer_phone)) {
              dc.visit_count = 0;
              dc.status_val = dc.status_val || 'New';
              dc.loyalty_points = dc.loyalty_points || 0;
              customers.push(dc);
              allPhones.add(dc.customer_phone);
            }
          }
        }
      } catch (_) {}

      // Enrich with customer data
      if (allPhones.size > 0) {
        try {
          const phoneArr = [...allPhones];
          const placeholders = phoneArr.map(() => '?').join(',');
          const custData: any = await query(
            `SELECT phone, name, loyalty_points, status, last_active FROM customers WHERE phone IN (${placeholders})`,
            phoneArr
          );
          const custMap: Map<string, any> = new Map();
          for (const row of (custData || [])) {
            custMap.set(row.phone, row);
          }
          for (const c of customers) {
            const data = custMap.get(c.customer_phone);
            if (data) {
              c.loyalty_points = c.loyalty_points || data.loyalty_points || 0;
              c.status_val = c.status_val || data.status || 'New';
              c.last_active = c.last_active || data.last_active;
              if (!c.customer_name) c.customer_name = data.name || c.customer_phone;
            } else {
              c.loyalty_points = c.loyalty_points || 0;
              c.status_val = c.status_val || 'New';
            }
          }
        } catch (_) {}
      }

      // Filter by search
      if (search) {
        const q = search.toLowerCase();
        customers = customers.filter((c: any) =>
          (c.customer_phone && c.customer_phone.includes(q)) ||
          (c.customer_name && c.customer_name.toLowerCase().includes(q))
        );
      }

      // Cap memory usage for large datasets
      if (customers.length > MAX_FETCH) {
        customers = customers.slice(0, MAX_FETCH);
      }

      // Sort by last_visit DESC
      customers.sort((a: any, b: any) => {
        if (!a.last_visit) return 1;
        if (!b.last_visit) return -1;
        return new Date(b.last_visit).getTime() - new Date(a.last_visit).getTime();
      });

      const total = customers.length;
      const offset = (pageNum - 1) * limitNum;
      customers = customers.slice(offset, offset + limitNum);

      res.json({ customers, total, page: pageNum, limit: limitNum });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch customers' });
    }
  });

  // ─── Admin: Customer Profile ────────────────────────────────────────
  app.get('/api/admin/customers/:phone', adminAuth, async (req: any, res) => {
    try {
      const customer = await getCustomerByPhone(req.params.phone);
      if (!customer) return res.status(404).json({ error: 'Customer not found' });

      const isSuperAdmin = req.adminRole === 'super_admin';
      const salonFilter = isSuperAdmin ? '' : ' AND sl.assigned_admin_id = ?';
      const params: any[] = [req.params.phone];
      if (!isSuperAdmin) params.push(req.adminId);

      const appointments: any = await query(
        `SELECT a.*, b.name as barber_name, s.name as service_name, sl.name as salon_name, a.recurring_booking_id, rb.frequency
         FROM appointments a
         JOIN barbers b ON a.barber_id = b.id
         JOIN services s ON a.service_id = s.id
         JOIN salons sl ON a.salon_id = sl.id
         LEFT JOIN recurring_bookings rb ON a.recurring_booking_id = rb.id
         WHERE a.customer_phone = ?${salonFilter}
         ORDER BY a.appointment_date DESC LIMIT 20`,
        params
      );

      const tags: any = await query(
        'SELECT tag FROM customer_tags WHERE customer_phone = ?',
        [req.params.phone]
      );

      res.json({ customer, appointments, tags: tags.map((t: any) => t.tag) });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch customer profile' });
    }
  });

  // ─── Admin: Create Customer ─────────────────────────────────────────
  app.post('/api/admin/customers', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const { name, phone, tags, status } = req.body;
      if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });
      const cleanPhone = normalizePhone(phone);
      const existing = await query('SELECT phone FROM customers WHERE phone = ?', [cleanPhone]);
      if (existing.length > 0) {
        return res.status(409).json({ error: 'Customer with this phone already exists', phone: cleanPhone });
      }
      await query(
        'INSERT INTO customers (phone, name, status) VALUES (?, ?, ?)',
        [cleanPhone, sanitizeString(name), status || 'New']
      );
      if (tags && Array.isArray(tags)) {
        for (const tag of tags) {
          await query(
            'INSERT INTO customer_tags (customer_phone, tag) VALUES (?, ?) ON DUPLICATE KEY UPDATE tag = VALUES(tag)',
            [cleanPhone, sanitizeString(tag.trim())]
          );
        }
      }
      res.json({ success: true, message: 'Customer created' });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to save customer' });
    }
  });

  // ─── Admin: Update Customer ─────────────────────────────────────────
  app.put('/api/admin/customers/:phone', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const { name, status, tags } = req.body;
      const phone = normalizePhone(req.params.phone);
      if (name) await query('UPDATE customers SET name = ? WHERE phone = ?', [sanitizeString(name), phone]);
      if (status) await query('UPDATE customers SET status = ? WHERE phone = ?', [status, phone]);
      if (tags && Array.isArray(tags)) {
        await query('DELETE FROM customer_tags WHERE customer_phone = ?', [phone]);
        for (const tag of tags) {
          await query(
            'INSERT IGNORE INTO customer_tags (customer_phone, tag) VALUES (?, ?)',
            [phone, sanitizeString(tag.trim())]
          );
        }
      }
      res.json({ success: true, message: 'Customer updated' });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update customer' });
    }
  });

  // ─── Admin: Delete Customer ─────────────────────────────────────────
  app.delete('/api/admin/customers/:phone', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const phone = normalizePhone(req.params.phone);
      await query('DELETE FROM customer_tags WHERE customer_phone = ?', [phone]);
      await query('DELETE FROM customers WHERE phone = ?', [phone]);
      res.json({ success: true, message: 'Customer deleted' });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete customer' });
    }
  });

  app.put('/api/admin/customers/:phone/status', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const { status } = req.body;
      const phone = normalizePhone(req.params.phone);
      await query('UPDATE customers SET status = ? WHERE phone = ?', [status, phone]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update status' });
    }
  });

  // ─── Admin: Chats / Inbox (Admin & Super Admin) ────────────────────
  app.get('/api/admin/chats', adminAuth, async (req, res) => {
    try {
      const salonId = req.query.salon_id ? Number(req.query.salon_id) : null;
      const msgContacts = await getChatContacts();
      const msgContactPhones = new Set(msgContacts.map(c => c.phone));
      let allUsersSql = "SELECT DISTINCT c.phone, c.name FROM customers c";
      const userParams: any[] = [];
      if (salonId) {
        allUsersSql = `SELECT DISTINCT c.phone, c.name FROM customers c JOIN appointments a ON c.phone = a.customer_phone WHERE a.salon_id = ?`;
        userParams.push(salonId);
      }
      allUsersSql += " ORDER BY c.name";
      const allUsers: any = await query(allUsersSql, userParams);
      const salonContactPhones = new Set(allUsers.map((u: any) => u.phone.includes('@s.whatsapp.net') ? u.phone : `${u.phone}@s.whatsapp.net`));
      const merged = new Map();
      for (const c of msgContacts) {
        if (salonId && !salonContactPhones.has(c.phone)) continue;
        merged.set(c.phone, { ...c, source: 'message' });
      }
      for (const u of allUsers) {
        const phone = u.phone.includes('@s.whatsapp.net') ? u.phone : `${u.phone}@s.whatsapp.net`;
        if (!merged.has(phone)) {
          merged.set(phone, { phone, name: u.name || u.phone, lastMessage: null, timestamp: null, source: 'customer' });
        }
      }
      const result = Array.from(merged.values()).sort((a, b) => {
        if (a.timestamp && b.timestamp) return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        if (a.timestamp) return -1;
        if (b.timestamp) return 1;
        return 0;
      });
      res.json(result);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch chats' });
    }
  });

  app.get('/api/admin/chats/:phone/messages', adminAuth, async (req, res) => {
    try {
      const messages = await getChatMessages(req.params.phone);
      res.json(messages);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  app.post('/api/admin/chats/:phone/messages', adminAuth, requireWriteAccess as any, async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: 'Message required' });
      const phone = req.params.phone;
      const fullPhone = phone.includes('@s.whatsapp.net') ? phone : `${phone}@s.whatsapp.net`;
      const sock = getWASocket();
      if (!sock || !isWAConnected()) return res.status(503).json({ error: 'WhatsApp not connected' });
      await Promise.race([
        sock.sendMessage(fullPhone, { text: message }).catch(() => {}),
        new Promise((_, reject) => setTimeout(() => reject(new Error('WhatsApp send timeout')), 15000))
      ]);
      await saveChatMessage({ sessionId: 'autozap-admin', phone: fullPhone, text: message, fromMe: true });
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: e?.message === 'WhatsApp send timeout' ? 'Message send timeout' : 'Failed to send message' });
    }
  });

  app.delete('/api/admin/chats/:phone/messages', adminAuth, requireWriteAccess as any, async (req, res) => {
    try {
      const phone = req.params.phone;
      const fullPhone = phone.includes('@s.whatsapp.net') ? phone : `${phone}@s.whatsapp.net`;
      await query('DELETE FROM messages WHERE phone = ?', [fullPhone]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete messages' });
    }
  });

  app.delete('/api/admin/chats/:phone/messages/:id', adminAuth, requireWriteAccess as any, async (req, res) => {
    try {
      const phone = req.params.phone;
      const fullPhone = phone.includes('@s.whatsapp.net') ? phone : `${phone}@s.whatsapp.net`;
      await query('DELETE FROM messages WHERE id = ? AND phone = ?', [req.params.id, fullPhone]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete message' });
    }
  });

  // ─── Admin: All Products ───────────────────────────────────────────
  app.get('/api/admin/products', adminAuth, async (req: any, res) => {
    try {
      const isSuperAdmin = req.adminRole === 'super_admin';
      const adminId = req.adminId;
      const { salon_id } = req.query;
      let sql = `SELECT p.*, sl.name as salon_name
                 FROM products p
                 JOIN salons sl ON p.salon_id = sl.id
                 WHERE 1=1`;
      const params: any[] = [];
      if (!isSuperAdmin) { sql += ' AND sl.assigned_admin_id = ?'; params.push(adminId); }
      if (salon_id) { sql += ' AND p.salon_id = ?'; params.push(Number(salon_id)); }
      sql += ' ORDER BY sl.name, p.name';
      const rows = await query(sql, params);
      res.json(rows);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  app.post('/api/admin/products', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const { salon_id, name, price, stock, min_stock, unit, id } = req.body;
      if (!salon_id || !name) return res.status(400).json({ error: 'salon_id and name required' });
      if (!(await checkSalonAccess(req, res, salon_id))) return;
      if (id) {
        await query('UPDATE products SET name = ?, price = ?, stock = ?, min_stock = ?, unit = ? WHERE id = ? AND salon_id = ?', [sanitizeString(name), price, stock || 0, min_stock || 0, sanitizeString(unit || 'pcs'), id, salon_id]);
      } else {
        await query('INSERT INTO products (salon_id, name, price, stock, min_stock, unit) VALUES (?, ?, ?, ?, ?, ?)', [salon_id, sanitizeString(name), price || 0, stock || 0, min_stock || 0, sanitizeString(unit || 'pcs')]);
      }
      res.json({ success: true });
    } catch (e: any) { console.error('[Admin Route Error]', e?.message || e); res.status(500).json({ error: 'Failed to save product' }); }
  });

  app.put('/api/admin/products/:id', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const prod: any = await query('SELECT salon_id FROM products WHERE id = ?', [req.params.id]);
      if (prod.length === 0) return res.status(404).json({ error: 'Product not found' });
      if (!(await checkSalonAccess(req, res, prod[0].salon_id))) return;
      const { name, price, stock, min_stock, unit } = req.body;
      await query('UPDATE products SET name = ?, price = ?, stock = ?, min_stock = ?, unit = ? WHERE id = ?', [sanitizeString(name), price, stock || 0, min_stock || 0, sanitizeString(unit || 'pcs'), req.params.id]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.delete('/api/admin/products/:id', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const prod: any = await query('SELECT salon_id FROM products WHERE id = ?', [req.params.id]);
      if (prod.length === 0) return res.status(404).json({ error: 'Product not found' });
      if (!(await checkSalonAccess(req, res, prod[0].salon_id))) return;
      await query('DELETE FROM products WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── WhatsApp Session Management (Super Admin Only) ────────────────
  app.get('/api/admin/sessions', adminAuth, async (req, res) => {
    try {
      let dbSessions: any[] = [];
      try {
        dbSessions = await query('SELECT * FROM whatsapp_sessions ORDER BY created_at DESC');
      } catch (_) {
        // Table may not exist yet
      }
      
      const sessionList: any[] = sessions ? Array.from((sessions as any).entries()).map((entry: any) => {
        const [id, s] = entry;
        return { id, session_id: id, status: s.status || 'DISCONNECTED', user: s.user || null, qr: s.qr || null };
      }) : [];

      // Add any in-memory sessions not yet in DB
      const dbIds = new Set(dbSessions.map((d: any) => d.session_id));
      for (const ls of sessionList) {
        if (!dbIds.has(ls.session_id)) {
          try {
            await query(
              'INSERT INTO whatsapp_sessions (session_id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
              [ls.session_id, ls.session_id]
            );
          } catch (_) {}
        }
      }

      // Re-fetch after potential insert
      try {
        dbSessions = await query('SELECT * FROM whatsapp_sessions ORDER BY created_at DESC');
      } catch (_) {}

      const merged = dbSessions.map((dbS: any) => {
        const live = sessionList.find(ls => ls.id === dbS.session_id);
        return {
          ...dbS,
          status: live ? live.status.toLowerCase() : 'disconnected',
          live_status: live ? live.status : 'DISCONNECTED',
          qr: live?.qr || null,
          user: live?.user || null
        };
      });

      // Include any sessions that exist in-memory but couldn't be saved to DB
      for (const ls of sessionList) {
        if (!merged.find((m: any) => m.session_id === ls.session_id)) {
          merged.push(ls);
        }
      }

      res.json(merged);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  });

  app.post('/api/admin/sessions/init', adminAuth, requireWriteAccess as any, async (req, res) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

      if (connectingSessions.has(sessionId)) {
        return res.json({ success: true, message: 'Already initializing' });
      }

      connectToWhatsApp(sessionId).catch((err: any) => {
        console.error(`[WhatsApp] REST init failed for ${sessionId}:`, err?.message || err);
      });
      res.json({ success: true, message: 'Session initializing' });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to init session' });
    }
  });

  app.post('/api/admin/sessions/restart', adminAuth, requireWriteAccess as any, async (req, res) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

      if (cleanupSession) cleanupSession(sessionId);
      sessions.delete(sessionId);
      connectingSessions.delete(sessionId);

      const dataDir = process.env.DATA_DIR || process.cwd();
      const authPath = path.join(dataDir, `auth-info-${sessionId}`);
      const fs = await import('fs');
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
      }

      io.emit('session-status', { sessionId, status: 'DISCONNECTED', message: 'Restarting...' });
      
      setTimeout(() => {
        connectToWhatsApp(sessionId).catch((err: any) => {
          console.error(`[WhatsApp] Restart failed for ${sessionId}:`, err?.message || err);
        });
      }, 1000);

      res.json({ success: true, message: 'Session restart triggered' });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to restart session' });
    }
  });

  app.put('/api/admin/sessions/:sessionId', adminAuth, requireWriteAccess as any, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { name } = req.body;
      if (name !== undefined) {
        await query('UPDATE whatsapp_sessions SET name = ? WHERE session_id = ?', [sanitizeString(name), sessionId]);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to update session' });
    }
  });

  app.delete('/api/admin/sessions/:sessionId', adminAuth, requireWriteAccess as any, async (req, res) => {
    try {
      const { sessionId } = req.params;
      if (cleanupSession) cleanupSession(sessionId);
      sessions.delete(sessionId);
      
      const dataDir = process.env.DATA_DIR || process.cwd();
      const authPath = path.join(dataDir, `auth-info-${sessionId}`);
      const fs = await import('fs');
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
      }

      await query('DELETE FROM whatsapp_sessions WHERE session_id = ?', [sessionId]);
      
      io.emit('session-status', { sessionId, status: 'DISCONNECTED', message: 'Deleted' });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to delete session' });
    }
  });

  // ─── Admin: Finances (Platform-wide) ──────────────────────────────
  app.get('/api/admin/finances', adminAuth, async (req: any, res) => {
    try {
      const isSuperAdmin = req.adminRole === 'super_admin';
      const adminId = req.adminId;
      const { salon_id } = req.query;
      const adminJoin = isSuperAdmin ? '' : ' JOIN salons sl ON a.salon_id = sl.id AND sl.assigned_admin_id = ?';
      const expJoin = isSuperAdmin ? '' : ' AND salon_id IN (SELECT id FROM salons WHERE assigned_admin_id = ?)';
      let revSql = `SELECT COALESCE(SUM(s.price), 0) as total FROM appointments a
                    JOIN services s ON a.service_id = s.id${adminJoin}
                    WHERE a.status = 'completed'`;
      let expSql = `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE 1=1${expJoin}`;
      const revParams: any[] = [];
      const expParams: any[] = [];
      if (!isSuperAdmin) { revParams.push(adminId); expParams.push(adminId); }
      if (salon_id) {
        revSql += ' AND a.salon_id = ?'; revParams.push(Number(salon_id));
        expSql += ' AND salon_id = ?'; expParams.push(Number(salon_id));
      }
      const [revenue]: any = await query(revSql, revParams);
      const [expenses]: any = await query(expSql, expParams);
      const totalRevenue = revenue?.total || 0;
      const totalExpenses = expenses?.total || 0;
      res.json({ revenue: totalRevenue, expenses: totalExpenses, profit: totalRevenue - totalExpenses });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch finances' });
    }
  });

  // ─── Admin Management (Super Admin only) ──────────────────────────
  app.get('/api/admin/admins', superAdminAuth, async (req, res) => {
    try {
      const admins = await getAllAdmins();
      res.json(admins);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch admins' });
    }
  });

  app.post('/api/admin/admins', superAdminAuth, async (req: any, res) => {
    try {
      const { name, email, password, role } = req.body;
      if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
      if (!['admin', 'support', 'viewer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
      const pwdError = validatePassword(password);
      if (pwdError) return res.status(400).json({ error: pwdError });
      const id = await createAdmin({ name: sanitizeString(name), email: sanitizeString(email), password, role });
      await createAuditLog({ admin_id: req.adminId, action: 'create_admin', entity_type: 'admin', entity_id: String(id), details: `Created admin ${sanitizeString(email)}` });
      res.json({ success: true, id });
    } catch (e: any) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email already exists' });
      res.status(500).json({ error: 'Failed to create admin' });
    }
  });

  app.put('/api/admin/admins/:id', superAdminAuth, async (req: any, res) => {
    try {
      const { name, email, role, is_active } = req.body;
      await updateAdmin(Number(req.params.id), { name: sanitizeString(name || ''), email: sanitizeString(email || ''), role, is_active });
      await createAuditLog({ admin_id: req.adminId, action: 'update_admin', entity_type: 'admin', entity_id: req.params.id, details: `Updated admin ${sanitizeString(email || req.params.id)}` });
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update admin' });
    }
  });

  app.delete('/api/admin/admins/:id', superAdminAuth, async (req: any, res) => {
    try {
      await deleteAdmin(Number(req.params.id));
      await createAuditLog({ admin_id: req.adminId, action: 'delete_admin', entity_type: 'admin', entity_id: req.params.id, details: `Deleted admin #${req.params.id}` });
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete admin' });
    }
  });

  // ─── Admin: Salon Data Management (for Enterprise Dashboard) ───
  
  function getSalonId(req: any): number | null {
    const id = parseInt(req.query.salonId || req.body.salonId);
    return isNaN(id) ? null : id;
  }

  app.get('/api/admin/staff', adminAuth, async (req: any, res) => {
    try {
      const salonId = getSalonId(req);
      if (!salonId) return res.json([]);
      if (!(await checkSalonAccess(req, res, salonId))) return;
      const rows = await query('SELECT * FROM barbers WHERE salon_id = ?', [salonId]);
      res.json(rows);
    } catch (e: any) { console.error('[Admin Staff]', e.message); res.status(500).json({ error: 'Failed to fetch staff' }); }
  });

  app.post('/api/admin/staff', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const { salonId, name, phone, role, salary, salaryType, commissionRate } = req.body;
      if (!salonId) return res.status(400).json({ error: 'salonId required' });
      if (!(await checkSalonAccess(req, res, salonId))) return;
      // Insert into barbers table (salary/commission go to staff or barbers table depending on design)
      const r: any = await query('INSERT INTO barbers (salon_id, name, phone, experience) VALUES (?,?,?,?)',
        [salonId, sanitizeString(name), sanitizeString(phone || ''), 0]);
      // Also insert into staff if salary provided
      if (salary && salaryType) {
        await query('INSERT INTO staff (salon_id, name, role, salary_type, base_salary) VALUES (?,?,?,?,?)',
          [salonId, sanitizeString(name), sanitizeString(role || 'Barber'), salaryType, salary]);
      }
      res.json({ success: true, id: r.insertId });
    } catch (e: any) { console.error('[Admin Staff]', e.message); res.status(500).json({ error: 'Failed to add staff' }); }
  });

  app.put('/api/admin/staff/:id', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const { name, phone, experience } = req.body;
      const rows: any = await query('SELECT salon_id FROM barbers WHERE id = ?', [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Staff not found' });
      if (!(await checkSalonAccess(req, res, rows[0].salon_id))) return;
      await query('UPDATE barbers SET name=?, phone=?, experience=? WHERE id=?',
        [sanitizeString(name), sanitizeString(phone || ''), experience || 0, req.params.id]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.delete('/api/admin/staff/:id', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const rows: any = await query('SELECT salon_id FROM barbers WHERE id = ?', [req.params.id]);
      if (rows.length === 0) return res.json({ success: true });
      if (!(await checkSalonAccess(req, res, rows[0].salon_id))) return;
      await query('DELETE FROM barbers WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.get('/api/admin/seats', adminAuth, async (req: any, res) => {
    try {
      const salonId = getSalonId(req);
      if (!salonId) return res.json([]);
      if (!(await checkSalonAccess(req, res, salonId))) return;
      const rows = await query('SELECT * FROM seats WHERE salon_id = ?', [salonId]);
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post('/api/admin/seats', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const { salonId, name, status } = req.body;
      if (!salonId) return res.status(400).json({ error: 'salonId required' });
      if (!(await checkSalonAccess(req, res, salonId))) return;
      const r: any = await query('INSERT INTO seats (salon_id, name, status) VALUES (?,?,?)', [salonId, sanitizeString(name), sanitizeString(status || 'Available')]);
      res.json({ success: true, id: r.insertId });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.put('/api/admin/seats/:id', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const rows: any = await query('SELECT salon_id FROM seats WHERE id = ?', [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Seat not found' });
      if (!(await checkSalonAccess(req, res, rows[0].salon_id))) return;
      const { name, status } = req.body;
      await query('UPDATE seats SET name=?, status=? WHERE id=?', [sanitizeString(name), sanitizeString(status), req.params.id]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.delete('/api/admin/seats/:id', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const rows: any = await query('SELECT salon_id FROM seats WHERE id = ?', [req.params.id]);
      if (rows.length === 0) return res.json({ success: true });
      if (!(await checkSalonAccess(req, res, rows[0].salon_id))) return;
      await query('DELETE FROM seats WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.get('/api/admin/settings', adminAuth, async (req: any, res) => {
    try {
      const salonId = getSalonId(req);
      if (!salonId) return res.json({});
      if (!(await checkSalonAccess(req, res, salonId))) return;
      const rows: any = await query('SELECT * FROM salons WHERE id = ?', [salonId]);
      if (rows.length === 0) return res.status(404).json({ error: 'Salon not found' });
      let settings: any = await query('SELECT * FROM shop_settings WHERE salon_id = ?', [salonId]);
      if (settings.length === 0) {
        // Do NOT insert here — the PUT handler upserts idempotently. Inserting on
        // GET caused "Duplicate entry '<id>' for key 'salon_id'" under concurrent loads.
        settings = [{ company_name: rows[0].name, currency: 'Rs.', language: 'Urdu/English' }];
      }
      res.json({
        companyName: settings[0].company_name,
        currency: settings[0].currency || 'Rs.',
        language: settings[0].language || 'Urdu/English',
        morningBriefingEnabled: true,
        finalCallEnabled: true,
        lastChanceEnabled: true
      });
    } catch (e: any) { console.error('[Admin Settings]', e.message); res.status(500).json({ error: 'Failed to fetch settings' }); }
  });

  app.post('/api/admin/settings', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const salonId = getSalonId(req);
      if (!salonId) return res.status(400).json({ error: 'salonId required' });
      if (!(await checkSalonAccess(req, res, salonId))) return;
      const { companyName, currency, language } = req.body;
      await query(
        `INSERT INTO shop_settings (salon_id, company_name, currency, language) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE company_name = VALUES(company_name), currency = VALUES(currency), language = VALUES(language)`,
        [salonId, sanitizeString(companyName || ''), sanitizeString(currency || 'Rs.'), sanitizeString(language || 'Urdu/English')]
      );
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.put('/api/admin/settings', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const salonId = getSalonId(req);
      if (!salonId) return res.status(400).json({ error: 'salonId required' });
      if (!(await checkSalonAccess(req, res, salonId))) return;
      const { companyName, currency, language, morningBriefingEnabled, finalCallEnabled, lastChanceEnabled } = req.body;
      await query(
        `INSERT INTO shop_settings (salon_id, company_name, currency, language) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE company_name = VALUES(company_name), currency = VALUES(currency), language = VALUES(language)`,
        [salonId, sanitizeString(companyName || ''), sanitizeString(currency || 'Rs.'), sanitizeString(language || 'Urdu/English')]
      );
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.get('/api/admin/bot/status/:phone', adminAuth, async (req: any, res) => {
    try {
      const rows: any = await query('SELECT paused FROM bot_paused WHERE phone = ?', [req.params.phone]);
      res.json({ paused: rows.length > 0 && rows[0].paused === 1 });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post('/api/admin/bot/status', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const { phone, paused } = req.body;
      await query('INSERT INTO bot_paused (phone, paused) VALUES (?, ?) ON DUPLICATE KEY UPDATE paused = ?', [phone, paused ? 1 : 0, paused ? 1 : 0]);
      res.json({ success: true, paused });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.get('/api/admin/settings/working-hours', adminAuth, async (req: any, res) => {
    try {
      const salonId = getSalonId(req);
      if (!salonId) return res.json([]);
      if (!(await checkSalonAccess(req, res, salonId))) return;
      const rows = await query('SELECT * FROM working_hours WHERE salon_id = ?', [salonId]);
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post('/api/admin/settings/working-hours', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const salonId = getSalonId(req);
      if (!salonId) return res.status(400).json({ error: 'salonId required' });
      if (!(await checkSalonAccess(req, res, salonId))) return;
      const body = req.body;
      const hours = Array.isArray(body) ? body : body?.hours;
      if (!Array.isArray(hours)) return res.status(400).json({ error: 'hours array required' });
      await beginTransaction();
      await query('DELETE FROM working_hours WHERE salon_id = ?', [salonId]);
      for (const h of hours) {
        await query('INSERT INTO working_hours (salon_id, day, start_time, end_time, is_open) VALUES (?, ?, ?, ?, ?)',
          [salonId, h.day, h.start || h.start_time, h.end || h.end_time, h.isOpen ?? h.is_open ?? 1]);
      }
      await commit();
      res.json({ success: true });
    } catch (e: any) { await rollback().catch(() => {}); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.delete('/api/admin/settings/working-hours/:id', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const rows: any = await query('SELECT salon_id FROM working_hours WHERE id = ?', [req.params.id]);
      if (rows.length === 0) return res.json({ success: true });
      if (!(await checkSalonAccess(req, res, rows[0].salon_id))) return;
      await query('DELETE FROM working_hours WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.put('/api/admin/settings/working-hours', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const body = req.body;
      const salonId = body?.salonId || getSalonId(req);
      if (!salonId) return res.status(400).json({ error: 'salonId required' });
      if (!(await checkSalonAccess(req, res, salonId))) return;
      const hours = Array.isArray(body) ? body : body?.hours;
      if (!Array.isArray(hours)) return res.status(400).json({ error: 'hours array required' });
      await beginTransaction();
      await query('DELETE FROM working_hours WHERE salon_id = ?', [salonId]);
      for (const h of hours) {
        await query('INSERT INTO working_hours (salon_id, day, start_time, end_time, is_open) VALUES (?, ?, ?, ?, ?)',
          [salonId, h.day, h.start || h.start_time, h.end || h.end_time, h.isOpen ?? h.is_open ?? 1]);
      }
      await commit();
      res.json({ success: true });
    } catch (e: any) { await rollback().catch(() => {}); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.get('/api/admin/salaries', adminAuth, async (req: any, res) => {
    try {
      const salonId = getSalonId(req);
      if (!salonId) return res.json([]);
      if (!(await checkSalonAccess(req, res, salonId))) return;
      const rows = await query('SELECT * FROM salaries WHERE salon_id = ?', [salonId]);
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post('/api/admin/salaries', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const salonId = getSalonId(req);
      if (!salonId) return res.status(400).json({ error: 'salonId required' });
      if (!(await checkSalonAccess(req, res, salonId))) return;
      const { staffId, staffName, amount, type, status } = req.body;
      const result: any = await query(
        'INSERT INTO salaries (salon_id, staff_id, amount, type, status, date) VALUES (?, ?, ?, ?, ?, NOW())',
        [salonId, staffId || null, amount, type || 'Salary', status || 'Paid']
      );
      res.json({ success: true, id: result.insertId });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.delete('/api/admin/salaries/:id', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const rows: any = await query('SELECT salon_id FROM salaries WHERE id = ?', [req.params.id]);
      if (rows.length === 0) return res.json({ success: true });
      if (!(await checkSalonAccess(req, res, rows[0].salon_id))) return;
      await query('DELETE FROM salaries WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.get('/api/admin/location', adminAuth, async (req: any, res) => {
    try {
      const salonId = getSalonId(req);
      if (!salonId) return res.json({});
      if (!(await checkSalonAccess(req, res, salonId))) return;
      const rows: any = await query('SELECT address, map_url FROM salons WHERE id = ?', [salonId]);
      res.json(rows[0] || {});
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post('/api/admin/location', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const salonId = getSalonId(req);
      if (!salonId) return res.status(400).json({ error: 'salonId required' });
      if (!(await checkSalonAccess(req, res, salonId))) return;
      const { address, mapUrl } = req.body;
      await query('UPDATE salons SET address = ?, map_url = ? WHERE id = ?', [sanitizeString(address || ''), sanitizeString(mapUrl || ''), salonId]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post('/api/admin/revenue', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const { salon_id, booking_id, amount, date } = req.body;
      if (!salon_id) return res.status(400).json({ error: 'salon_id required' });
      if (!(await checkSalonAccess(req, res, salon_id))) return;
      await query('INSERT INTO revenue (salon_id, booking_id, amount, date) VALUES (?, ?, ?, ?)', [salon_id, booking_id || null, amount, date]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Admin Services (for Finances page) ───────────────────────────
  app.get('/api/admin/services', adminAuth, async (req: any, res) => {
    try {
      const salonId = req.query.salonId ? Number(req.query.salonId) : null;
      const rows: any = salonId ? await query('SELECT * FROM services WHERE salon_id = ?', [salonId]) : await query('SELECT * FROM services');
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post('/api/admin/services', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const { salonId, name, price, duration, category, description } = req.body;
      if (!salonId || !name) return res.status(400).json({ error: 'salonId and name required' });
      if (!(await checkSalonAccess(req, res, salonId))) return;
      const r: any = await query('INSERT INTO services (salon_id, name, price, duration, category, description) VALUES (?, ?, ?, ?, ?, ?)', [salonId, sanitizeString(name), price || 0, duration || 30, sanitizeString(category || ''), sanitizeString(description || '')]);
      res.json({ success: true, id: r.insertId });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.put('/api/admin/services/:id', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const svc: any = await query('SELECT salon_id FROM services WHERE id = ?', [req.params.id]);
      if (svc.length === 0) return res.status(404).json({ error: 'Service not found' });
      if (!(await checkSalonAccess(req, res, svc[0].salon_id))) return;
      const { name, price, duration, category, description } = req.body;
      await query('UPDATE services SET name = ?, price = ?, duration = ?, category = ?, description = ? WHERE id = ?', [sanitizeString(name), price, duration || 30, sanitizeString(category || ''), sanitizeString(description || ''), req.params.id]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.delete('/api/admin/services/:id', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const svc: any = await query('SELECT salon_id FROM services WHERE id = ?', [req.params.id]);
      if (svc.length === 0) return res.status(404).json({ error: 'Service not found' });
      if (!(await checkSalonAccess(req, res, svc[0].salon_id))) return;
      await query('DELETE FROM services WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Admin Expenses (for Finances page) ───────────────────────────
  app.get('/api/admin/expenses', adminAuth, async (req: any, res) => {
    try {
      const salonId = req.query.salonId ? Number(req.query.salonId) : null;
      const rows: any = salonId ? await query('SELECT * FROM expenses WHERE salon_id = ? ORDER BY date DESC', [salonId]) : await query('SELECT * FROM expenses ORDER BY date DESC');
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post('/api/admin/expenses', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const { salon_id, description, amount, category, date } = req.body;
      if (!salon_id) return res.status(400).json({ error: 'salon_id required' });
      if (!(await checkSalonAccess(req, res, salon_id))) return;
      await query('INSERT INTO expenses (salon_id, description, amount, category, date) VALUES (?, ?, ?, ?, ?)', [salon_id, sanitizeString(description || ''), amount, sanitizeString(category || 'Other'), date || new Date().toISOString().split('T')[0]]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.put('/api/admin/expenses/:id', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const exp: any = await query('SELECT salon_id FROM expenses WHERE id = ?', [req.params.id]);
      if (exp.length === 0) return res.status(404).json({ error: 'Expense not found' });
      if (!(await checkSalonAccess(req, res, exp[0].salon_id))) return;
      const { description, amount, category, date } = req.body;
      await query('UPDATE expenses SET description = ?, amount = ?, category = ?, date = ? WHERE id = ?', [sanitizeString(description || ''), amount, sanitizeString(category || ''), date, req.params.id]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.delete('/api/admin/expenses/:id', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const exp: any = await query('SELECT salon_id FROM expenses WHERE id = ?', [req.params.id]);
      if (exp.length === 0) return res.status(404).json({ error: 'Expense not found' });
      if (!(await checkSalonAccess(req, res, exp[0].salon_id))) return;
      await query('DELETE FROM expenses WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Admin Revenue (GET/DELETE for Finances) ──────────────────────
  app.get('/api/admin/revenue', adminAuth, async (req: any, res) => {
    try {
      const salonId = req.query.salonId ? Number(req.query.salonId) : null;
      const rows: any = salonId ? await query('SELECT * FROM revenue WHERE salon_id = ? ORDER BY date DESC', [salonId]) : await query('SELECT * FROM revenue ORDER BY date DESC');
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.delete('/api/admin/revenue/:id', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const rev: any = await query('SELECT salon_id FROM revenue WHERE id = ?', [req.params.id]);
      if (rev.length === 0) return res.status(404).json({ error: 'Revenue not found' });
      if (!(await checkSalonAccess(req, res, rev[0].salon_id))) return;
      await query('DELETE FROM revenue WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.put('/api/admin/revenue/:id', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const rev: any = await query('SELECT salon_id FROM revenue WHERE id = ?', [req.params.id]);
      if (rev.length === 0) return res.status(404).json({ error: 'Revenue not found' });
      if (!(await checkSalonAccess(req, res, rev[0].salon_id))) return;
      const { amount, date } = req.body;
      await query('UPDATE revenue SET amount = ?, date = ? WHERE id = ?', [amount, date, req.params.id]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Automation Rules ──────────────────────────────────────────────
  app.get('/api/admin/automations', adminAuth, async (req: any, res) => {
    try {
      const rules = await getAutomationRules();
      res.json(rules);
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post('/api/admin/automations', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const { salon_id, trigger_type, action_type, action_config } = req.body;
      if (!salon_id || !trigger_type || !action_type) return res.status(400).json({ error: 'salon_id, trigger_type, action_type required' });
      const id = await createAutomationRule({ salon_id, trigger_type, action_type, action_config });
      res.json({ success: true, id });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.put('/api/admin/automations/:id', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      await updateAutomationRule(Number(req.params.id), req.body);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.delete('/api/admin/automations/:id', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      await deleteAutomationRule(Number(req.params.id));
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Admin: Broadcast ──────────────────────────────────────────────
  app.post('/api/admin/broadcast', superAdminAuth, async (req: any, res) => {
    try {
      const { text, salonId, sessionId } = req.body;
      if (!text) return res.status(400).json({ error: 'Text is required' });

      const targetSalonId = salonId || req.query.salonId || 0;
      let customers: any = [];
      if (targetSalonId && Number(targetSalonId) > 0) {
        customers = await query(
          `SELECT DISTINCT c.phone, c.name FROM customers c
           JOIN appointments a ON c.phone = a.customer_phone
           WHERE a.salon_id = ? AND c.phone IS NOT NULL AND c.phone != ''`,
          [targetSalonId]
        );
      } else {
        customers = await query('SELECT DISTINCT phone, name FROM customers WHERE phone IS NOT NULL AND phone != \'\'');
      }
      if (customers.length === 0) return res.json({ success: true, sentCount: 0 });

      const sid = sessionId || req.query.sessionId || 'default';
      const session = sessions?.get(sid);
      const sock = session?.socket || null;
      if (!sock) return res.json({ success: true, sentCount: 0, message: 'WhatsApp not connected' });

      // Safety: cap recipients per broadcast and pace sends to avoid WhatsApp
      // ban / overload. Large audiences are sent sequentially with jitter.
      const MAX_BROADCAST = Number(process.env.MAX_BROADCAST || 500);
      const recipients = customers.slice(0, MAX_BROADCAST);
      const DELAY_MS = Number(process.env.WA_SEND_INTERVAL_MS || 1000);
      let sentCount = 0;
      const errors: string[] = [];

      for (const c of recipients) {
        const phone = c.phone.includes('@s.whatsapp.net') ? c.phone : `${c.phone}@s.whatsapp.net`;
        const personalized = text.replace(/{Name}/gi, c.name || 'Valued Customer');
        try {
          await sock.sendMessage(phone, { text: personalized });
          sentCount++;
        } catch (err: any) {
          errors.push(c.phone);
          if (String(err?.message || '').includes('timeout')) break; // stop on socket timeout
        }
        await new Promise(resolve => setTimeout(resolve, DELAY_MS + Math.floor(Math.random() * 400)));
      }

      try {
        await query('INSERT INTO notification_logs (salon_id, notification_type, customer_phone, message_sent, sent_at) VALUES (?, ?, ?, ?, NOW())',
          [targetSalonId, 'broadcast', `${sentCount} recipients`, text.substring(0, 200)]);
      } catch {}

      res.json({ success: true, sentCount, total: customers.length, errors: errors.length });
    } catch (e: any) {
      console.error('[Admin Broadcast Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to send broadcast' });
    }
  });

  // ─── Database Reset ────────────────────────────────────────────────
  app.post('/api/admin/database/reset', superAdminAuth, async (req: any, res) => {
    try {
      if (req.body.confirm !== 'RESET_ALL_DATA') {
        return res.status(400).json({ error: 'Please send { confirm: "RESET_ALL_DATA" } to confirm.' });
      }

      const tablesToClear = [
        'customer_tags', 'bot_paused', 'bot_states',
        'notification_logs', 'sent_notifications', 'audit_logs',
        'barber_attendance', 'salaries',
        'disputes', 'payouts', 'recurring_bookings',
        'broadcast_notifications', 'templates', 'coupons',
        'reviews', 'offers', 'appointments',
        'revenue', 'expenses', 'messages'
      ];

      await beginTransaction();
      try {
        for (const table of tablesToClear) {
          try { await query(`DELETE FROM \`${table}\``); } catch (_) {}
        }
        try { await query('UPDATE customers SET total_visits = 0, loyalty_points = 0, global_points = 0, last_status = NULL, last_active = NULL'); } catch (_) {}
        await commit();
      } catch (txErr) {
        await rollback();
        throw txErr;
      }

      res.json({ success: true, message: 'Database reset completed. Operational data cleared.' });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Database reset failed: ' + e.message });
    }
  });

  // ─── Platform Settings ────────────────────────────────────────────
  app.get('/api/admin/platform-settings', adminAuth, async (req: any, res) => {
    try {
      const settings = await getAllSettings();
      res.json(settings);
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post('/api/admin/platform-settings', superAdminAuth, async (req: any, res) => {
    try {
      const { setting_key, setting_value, setting_type, description } = req.body;
      if (!setting_key || setting_value === undefined) return res.status(400).json({ error: 'setting_key and setting_value required' });
      await upsertSetting({ setting_key: sanitizeString(setting_key), setting_value: sanitizeString(setting_value), setting_type, description: sanitizeString(description || ''), updated_by: req.adminId });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.put('/api/admin/platform-settings/:key', superAdminAuth, async (req: any, res) => {
    try {
      const { setting_value, setting_type, description } = req.body;
      await upsertSetting({ setting_key: req.params.key, setting_value: sanitizeString(setting_value), setting_type, description: sanitizeString(description || ''), updated_by: req.adminId });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.delete('/api/admin/platform-settings/:key', superAdminAuth, async (req: any, res) => {
    try {
      await deleteSetting(req.params.key);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Payouts ───────────────────────────────────────────────────────
  app.get('/api/admin/payouts', superAdminAuth, async (req: any, res) => {
    try {
      const rows = await getPayouts(req.query.status as string);
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post('/api/admin/payouts', superAdminAuth, async (req: any, res) => {
    try {
      const { salon_id, amount, barber_id, notes } = req.body;
      if (!salon_id || !amount) return res.status(400).json({ error: 'salon_id and amount required' });
      const id = await createPayout({ salon_id, amount, barber_id, notes: sanitizeString(notes || '') });
      res.json({ success: true, id });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.put('/api/admin/payouts/:id/status', superAdminAuth, async (req: any, res) => {
    try {
      const { status, notes } = req.body;
      if (!status) return res.status(400).json({ error: 'status required' });
      await updatePayoutStatus(Number(req.params.id), status, req.adminId, sanitizeString(notes || ''));
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Disputes ──────────────────────────────────────────────────────
  app.get('/api/admin/disputes', adminAuth, async (req: any, res) => {
    try {
      const rows = await getDisputes(req.query.status as string);
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post('/api/admin/disputes', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const { salon_id, customer_phone, appointment_id, reason } = req.body;
      if (!reason) return res.status(400).json({ error: 'reason required' });
      const id = await createDispute({ salon_id, customer_phone, appointment_id, title: sanitizeString(reason || ''), description: sanitizeString(reason || '') });
      res.json({ success: true, id });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.put('/api/admin/disputes/:id/status', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const { status, resolution } = req.body;
      if (!status || !resolution) return res.status(400).json({ error: 'status and resolution required' });
      await updateDisputeStatus(Number(req.params.id), status, sanitizeString(resolution || ''), req.adminId);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Coupons ───────────────────────────────────────────────────────
  app.get('/api/admin/coupons', superAdminAuth, async (req: any, res) => {
    try {
      const rows = await getCoupons();
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post('/api/admin/coupons', superAdminAuth, async (req: any, res) => {
    try {
      const { code, type, value, min_amount, max_uses, valid_from, valid_until } = req.body;
      if (!code || !type || !value) return res.status(400).json({ error: 'code, type, value required' });
      const id = await createCoupon({ code: sanitizeString(code), type, value, min_amount, max_uses, valid_from, valid_until, created_by: req.adminId });
      res.json({ success: true, id });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.put('/api/admin/coupons/:id', superAdminAuth, async (req: any, res) => {
    try {
      const { code, type, value, min_amount, max_uses, valid_from, valid_until } = req.body;
      await updateCoupon(Number(req.params.id), { code: sanitizeString(code || ''), type, value, min_amount, max_uses, valid_from, valid_until, updated_by: req.adminId });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.delete('/api/admin/coupons/:id', superAdminAuth, async (req: any, res) => {
    try {
      await deleteCoupon(Number(req.params.id));
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Attendance (Admin) ──────────────────────────────────────────
  app.get('/api/admin/attendance', adminAuth, async (req: any, res) => {
    try {
      const salonId = req.query.salon_id ? Number(req.query.salon_id) : null;
      const date = req.query.date as string || new Date().toISOString().split('T')[0];
      const days = parseInt(req.query.days as string) || 30;
      let rows;
      if (salonId) {
        rows = await getAttendanceHistory(salonId, days);
      } else {
        rows = await getAttendanceHistory(null, days);
      }
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.put('/api/admin/attendance/:id', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      await updateAttendance(Number(req.params.id), req.body);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.delete('/api/admin/attendance/:id', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      await deleteAttendance(Number(req.params.id));
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: 'Internal server error' }); }
  });

  app.get('/api/admin/audit-logs', adminAuth, async (req: any, res) => {
    try {
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
      const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
      const [data, total] = await Promise.all([
        getAuditLogs(limit, offset),
        getAuditLogsCount()
      ]);
      res.json({ data, total });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  });

  app.get('/api/admin/pending-bookings', adminAuth, async (req: any, res) => {
    try {
      const salonId = req.query.salonId ? Number(req.query.salonId) : undefined;
      const isSuperAdmin = req.adminRole === 'super_admin';
      let bookings = await getPendingBookings(salonId);
      if (!isSuperAdmin && salonId) {
        bookings = bookings.filter((b: any) => {
          const access = true;
          return access;
        });
      }
      res.json(bookings);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch pending bookings' });
    }
  });

  app.post('/api/admin/pending-bookings/:id/flush', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const pb: any = await query('SELECT salon_id FROM pending_bookings WHERE id = ?', [req.params.id]);
      if (pb.length === 0) return res.status(404).json({ error: 'Pending booking not found' });
      if (!(await checkSalonAccess(req, res, pb[0].salon_id))) return;
      const result = await flushPendingBookings(pb[0].salon_id);
      res.json({ success: true, flushed: result.flushed, failed: result.failed });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to flush pending bookings' });
    }
  });

  app.delete('/api/admin/pending-bookings/:id', adminAuth, requireWriteAccess as any, async (req: any, res) => {
    try {
      const pb: any = await query('SELECT salon_id FROM pending_bookings WHERE id = ?', [req.params.id]);
      if (pb.length === 0) return res.status(404).json({ error: 'Pending booking not found' });
      if (!(await checkSalonAccess(req, res, pb[0].salon_id))) return;
      await deletePendingBooking(Number(req.params.id));
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete pending booking' });
    }
  });
}
