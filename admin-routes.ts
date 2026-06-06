import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'salonlink-super-secret-key-change-in-prod';

import { query, getChatContacts, getChatMessages, saveChatMessage, getCustomerByPhone, getAdminByEmail, getAllAdmins, createAdmin, updateAdmin, deleteAdmin, updateAdminLogin } from './db';

function adminAuth(req: any, res: any, next: any) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET) as { role: string };
    if (decoded.role !== 'super_admin' && decoded.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    req.isAdmin = true;
    req.adminRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function superAdminAuth(req: any, res: any, next: any) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET) as { role: string };
    if (decoded.role !== 'super_admin') return res.status(403).json({ error: 'Only super admin allowed' });
    req.isAdmin = true;
    req.adminRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function setupAdminRoutes(app: express.Application, context?: any) {
  const { sessions, connectToWhatsApp, connectingSessions, io } = context || {};

  // ─── Admin Auth ────────────────────────────────────────────────────
  app.post('/api/admin/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email aur password required' });

      const admin = await getAdminByEmail(email);
      if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
      if (!admin.is_active) return res.status(403).json({ error: 'Account is disabled' });
      if (!bcrypt.compareSync(password, admin.password || '')) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign({ role: admin.role, email, id: admin.id }, JWT_SECRET, { expiresIn: '24h' });
      await updateAdminLogin(admin.id);
      res.json({ token, admin: { email: admin.email, name: admin.name, role: admin.role } });
    } catch (e: any) {
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.get('/api/admin/auth/me', adminAuth, async (req: any, res) => {
    const decoded = jwt.verify(req.headers.authorization.split(' ')[1], JWT_SECRET) as any;
    const admin = await getAdminByEmail(decoded.email);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    res.json({ email: admin.email, name: admin.name, role: admin.role });
  });

  // ─── Platform Stats ────────────────────────────────────────────────
  app.get('/api/admin/stats', adminAuth, async (req, res) => {
    try {
      const salons: any = await query('SELECT COUNT(*) as total FROM salons');
      const activeSalons: any = await query("SELECT COUNT(*) as total FROM salons WHERE status = 'active'");
      const barbers: any = await query("SELECT COUNT(*) as total FROM barbers WHERE status = 'active'");
      const customers: any = await query('SELECT COUNT(DISTINCT customer_phone) as total FROM appointments');
      const appointments: any = await query('SELECT COUNT(*) as total FROM appointments');
      const completed: any = await query("SELECT COUNT(*) as total FROM appointments WHERE status = 'completed'");
      const revenue: any = await query(
        `SELECT COALESCE(SUM(s.price), 0) as total FROM appointments a JOIN services s ON a.service_id = s.id WHERE a.status = 'completed'`
      );
      const countries: any = await query('SELECT COUNT(*) as total FROM countries WHERE is_active = TRUE');
      const cities: any = await query('SELECT COUNT(*) as total FROM cities WHERE is_active = TRUE');
      const areas: any = await query('SELECT COUNT(*) as total FROM areas WHERE is_active = TRUE');

      const topSalons: any = await query(
        `SELECT s.name, s.email, s.status, COUNT(a.id) as bookings, COALESCE(SUM(srv.price), 0) as revenue
         FROM salons s LEFT JOIN appointments a ON s.id = a.salon_id AND a.status = 'completed'
         LEFT JOIN services srv ON a.service_id = srv.id
         GROUP BY s.id ORDER BY bookings DESC LIMIT 10`
      );

      const trend: any = await query(
        `SELECT DATE(a.appointment_date) as date, COUNT(*) as bookings
         FROM appointments a WHERE a.appointment_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         GROUP BY DATE(a.appointment_date) ORDER BY date`
      );

      const totalVisits: any = await query('SELECT COUNT(*) as total FROM profile_visits');
      const visitsToday: any = await query(
        'SELECT COUNT(*) as total FROM profile_visits WHERE visit_time >= CURDATE()'
      );

      res.json({
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
        totalVisits: totalVisits[0]?.total || 0,
        visitsToday: visitsToday[0]?.total || 0,
        conversionRate: appointments[0]?.total > 0 ? ((completed[0]?.total / totalVisits[0]?.total) * 100).toFixed(2) : 0,
        topSalons,
        bookingTrend: trend
      });
    } catch (e: any) {
      console.error('Admin stats error:', e);
      res.status(500).json({ error: 'Failed to load stats' });
    }
  });

  app.get('/api/admin/leads', adminAuth, async (req, res) => {
    try {
      const rows: any = await query(
        `SELECT pv.*, c.name as customer_name, sl.name as salon_name, b.name as barber_name
         FROM profile_visits pv
         LEFT JOIN customers c ON pv.customer_phone = c.phone
         JOIN salons sl ON pv.salon_id = sl.id
         LEFT JOIN barbers b ON pv.barber_id = b.id
         ORDER BY pv.visit_time DESC LIMIT 100`
      );
      res.json(rows);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch global leads' });
    }
  });

  // ─── Countries CRUD ────────────────────────────────────────────────
  app.get('/api/admin/locations/countries', adminAuth, async (req, res) => {
    try {
      const rows: any = await query('SELECT * FROM countries ORDER BY name');
      res.json(rows);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch countries' });
    }
  });

  app.post('/api/admin/locations/countries', adminAuth, async (req, res) => {
    try {
      const { name, phone_code, is_active } = req.body;
      if (!name) return res.status(400).json({ error: 'Name required' });
      const r: any = await query('INSERT INTO countries (name, phone_code, is_active) VALUES (?,?,?)',
        [name, phone_code || null, !!is_active]);
      const rows: any = await query('SELECT * FROM countries WHERE id = ?', [r.insertId]);
      res.json(rows[0]);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to create country' });
    }
  });

  app.put('/api/admin/locations/countries/:id', adminAuth, async (req, res) => {
    try {
      const { name, phone_code, is_active } = req.body;
      await query('UPDATE countries SET name=?, phone_code=?, is_active=? WHERE id=?',
        [name, phone_code || null, !!is_active, req.params.id]);
      const rows: any = await query('SELECT * FROM countries WHERE id = ?', [req.params.id]);
      res.json(rows[0]);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update country' });
    }
  });

  app.delete('/api/admin/locations/countries/:id', adminAuth, async (req, res) => {
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
      res.json(rows);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch cities' });
    }
  });

  app.post('/api/admin/locations/cities', adminAuth, async (req, res) => {
    try {
      const { country_id, name, is_active } = req.body;
      if (!country_id || !name) return res.status(400).json({ error: 'country_id aur name required' });
      const r: any = await query('INSERT INTO cities (country_id, name, is_active) VALUES (?,?,?)',
        [country_id, name, !!is_active]);
      const rows: any = await query('SELECT * FROM cities WHERE id = ?', [r.insertId]);
      res.json(rows[0]);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to create city' });
    }
  });

  app.put('/api/admin/locations/cities/:id', adminAuth, async (req, res) => {
    try {
      const { name, is_active } = req.body;
      await query('UPDATE cities SET name=?, is_active=? WHERE id=?',
        [name, !!is_active, req.params.id]);
      const rows: any = await query('SELECT * FROM cities WHERE id = ?', [req.params.id]);
      res.json(rows[0]);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update city' });
    }
  });

  app.delete('/api/admin/locations/cities/:id', adminAuth, async (req, res) => {
    try {
      await query('DELETE FROM areas WHERE city_id = ?', [req.params.id]);
      await query('DELETE FROM cities WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete city' });
    }
  });

  // ─── Areas CRUD ───────────────────────────────────────────────────
  app.get('/api/admin/locations/areas/:cityId', adminAuth, async (req, res) => {
    try {
      const rows: any = await query('SELECT * FROM areas WHERE city_id = ? ORDER BY name', [req.params.cityId]);
      res.json(rows);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch areas' });
    }
  });

  app.post('/api/admin/locations/areas', adminAuth, async (req, res) => {
    try {
      const { city_id, name, is_active } = req.body;
      if (!city_id || !name) return res.status(400).json({ error: 'city_id aur name required' });
      const r: any = await query('INSERT INTO areas (city_id, name, is_active) VALUES (?,?,?)',
        [city_id, name, !!is_active]);
      const rows: any = await query('SELECT * FROM areas WHERE id = ?', [r.insertId]);
      res.json(rows[0]);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to create area' });
    }
  });

  app.put('/api/admin/locations/areas/:id', adminAuth, async (req, res) => {
    try {
      const { name, is_active } = req.body;
      await query('UPDATE areas SET name=?, is_active=? WHERE id=?',
        [name, !!is_active, req.params.id]);
      const rows: any = await query('SELECT * FROM areas WHERE id = ?', [req.params.id]);
      res.json(rows[0]);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update area' });
    }
  });

  app.delete('/api/admin/locations/areas/:id', adminAuth, async (req, res) => {
    try {
      await query('DELETE FROM areas WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete area' });
    }
  });

  // ─── Salon Management ─────────────────────────────────────────────
  app.get('/api/admin/salons', adminAuth, async (req, res) => {
    try {
      const rows: any = await query(
        `SELECT s.*, c.name as country_name, ct.name as city_name, a.name as area_name
         FROM salons s
         LEFT JOIN countries c ON s.country_id = c.id
         LEFT JOIN cities ct ON s.city_id = ct.id
         LEFT JOIN areas a ON s.area_id = a.id
         ORDER BY s.created_at DESC`
      );
      res.json(rows);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch salons' });
    }
  });

  app.post('/api/admin/salons', adminAuth, async (req, res) => {
    try {
      const { name, owner_name, phone, email, password, country_id, city_id, area_id, address, description } = req.body;
      if (!name || !email || !password) return res.status(400).json({ error: 'Name, email aur password required' });

      const hash = await bcrypt.hash(password, 10);
      const r: any = await query(
        `INSERT INTO salons (name, owner_name, phone, email, password, country_id, city_id, area_id, address, description, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,'active')`,
        [name, owner_name || null, phone || null, email, hash, country_id || null, city_id || null, area_id || null, address || null, description || null]
      );
      res.json({ success: true, id: r.insertId });
    } catch (e: any) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email already exists' });
      res.status(500).json({ error: 'Failed to create salon' });
    }
  });

  app.put('/api/admin/salons/:id', adminAuth, async (req, res) => {
    try {
      const { name, owner_name, phone, email, country_id, city_id, area_id, address, description } = req.body;
      await query(
        `UPDATE salons SET name=?, owner_name=?, phone=?, email=?, country_id=?, city_id=?, area_id=?, address=?, description=? WHERE id=?`,
        [name, owner_name || null, phone || null, email, country_id || null, city_id || null, area_id || null, address || null, description || null, req.params.id]
      );
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update salon' });
    }
  });

  app.put('/api/admin/salons/:id/status', adminAuth, async (req, res) => {
    try {
      const { status } = req.body;
      if (!['active', 'inactive', 'pending'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
      await query('UPDATE salons SET status = ? WHERE id = ?', [status, req.params.id]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update status' });
    }
  });

  app.post('/api/admin/salons/:id/reset-password', adminAuth, async (req, res) => {
    try {
      const { newPassword } = req.body;
      if (!newPassword) return res.status(400).json({ error: 'newPassword required' });
      const hash = await bcrypt.hash(newPassword, 10);
      await query('UPDATE salons SET password = ? WHERE id = ?', [hash, req.params.id]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  app.delete('/api/admin/salons/:id', adminAuth, async (req, res) => {
    try {
      await query('DELETE FROM salons WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete salon' });
    }
  });

  // ─── Admin: All Appointments ────────────────────────────────────────
  app.get('/api/admin/appointments', adminAuth, async (req, res) => {
    try {
      const { salon_id, date, status, limit: qLimit } = req.query;
      let sql = `SELECT a.*, b.name as barber_name, s.name as service_name, sl.name as salon_name
                 FROM appointments a
                 JOIN barbers b ON a.barber_id = b.id
                 JOIN services s ON a.service_id = s.id
                 JOIN salons sl ON a.salon_id = sl.id
                 WHERE 1=1`;
      const params: any[] = [];
      if (salon_id) { sql += ' AND a.salon_id = ?'; params.push(Number(salon_id)); }
      if (date) { sql += ' AND a.appointment_date = ?'; params.push(date); }
      if (status) { sql += ' AND a.status = ?'; params.push(status); }
      sql += ' ORDER BY a.created_at DESC';
      if (qLimit) sql += ' LIMIT ?';
      const rows = await query(sql, params);
      res.json(rows);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch appointments' });
    }
  });

  // ─── Admin: All Customers ───────────────────────────────────────────
  app.get('/api/admin/customers', adminAuth, async (req, res) => {
    try {
      const { salon_id, search } = req.query;
      let sql = `SELECT DISTINCT a.customer_phone, a.customer_name,
                  COUNT(a.id) as total_visits,
                  COALESCE(c.loyalty_points, 0) as loyalty_points,
                  MAX(a.appointment_date) as last_visit,
                  COALESCE(c.status, 0) as status,
                  c.last_active,
                  sl.name as salon_name
                 FROM appointments a
                 LEFT JOIN customers c ON a.customer_phone = c.phone
                 JOIN salons sl ON a.salon_id = sl.id
                 WHERE 1=1`;
      const params: any[] = [];
      if (salon_id) { sql += ' AND a.salon_id = ?'; params.push(Number(salon_id)); }
      if (search) {
        sql += ' AND (a.customer_phone LIKE ? OR a.customer_name LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }
      sql += ' GROUP BY a.customer_phone, sl.id ORDER BY last_visit DESC';
      const rows = await query(sql, params);
      res.json(rows);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch customers' });
    }
  });

  // ─── Admin: Customer Profile ────────────────────────────────────────
  app.get('/api/admin/customers/:phone', adminAuth, async (req, res) => {
    try {
      const customer = await getCustomerByPhone(req.params.phone);
      if (!customer) return res.status(404).json({ error: 'Customer not found' });

      const appointments: any = await query(
        `SELECT a.*, b.name as barber_name, s.name as service_name, sl.name as salon_name
         FROM appointments a
         JOIN barbers b ON a.barber_id = b.id
         JOIN services s ON a.service_id = s.id
         JOIN salons sl ON a.salon_id = sl.id
         WHERE a.customer_phone = ?
         ORDER BY a.appointment_date DESC LIMIT 20`,
        [req.params.phone]
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

  // ─── Admin: Chats / Inbox (Admin & Super Admin) ────────────────────
  app.get('/api/admin/chats', adminAuth, async (req, res) => {
    try {
      const contacts = await getChatContacts();
      res.json(contacts);
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

  app.post('/api/admin/chats/:phone/messages', adminAuth, async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: 'Message required' });
      const phone = req.params.phone;
      const fullPhone = phone.includes('@s.whatsapp.net') ? phone : `${phone}@s.whatsapp.net`;
      const { getWASocket } = await import('./notification-service');
      const sock = getWASocket();
      if (!sock) return res.status(500).json({ error: 'WhatsApp not connected' });
      await sock.sendMessage(fullPhone, { text: message });
      await saveChatMessage({ phone: fullPhone, text: message, fromMe: true });
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // ─── Admin: All Products ───────────────────────────────────────────
  app.get('/api/admin/products', adminAuth, async (req, res) => {
    try {
      const { salon_id } = req.query;
      let sql = `SELECT p.*, sl.name as salon_name
                 FROM products p
                 JOIN salons sl ON p.salon_id = sl.id
                 WHERE 1=1`;
      const params: any[] = [];
      if (salon_id) { sql += ' AND p.salon_id = ?'; params.push(Number(salon_id)); }
      sql += ' ORDER BY sl.name, p.name';
      const rows = await query(sql, params);
      res.json(rows);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  // ─── WhatsApp Session Management (Super Admin Only) ────────────────
  app.get('/api/admin/sessions', superAdminAuth, async (req, res) => {
    try {
      const dbSessions: any = await query('SELECT * FROM whatsapp_sessions ORDER BY created_at DESC');
      
      const sessionList = Array.from(sessions.entries()).map(([id, s]: [string, any]) => ({
        id,
        session_id: id,
        status: s.status,
        user: s.user,
        qr: s.qr
      }));

      // Merge DB info with live status
      const merged = dbSessions.map((dbS: any) => {
        const live = sessionList.find(ls => ls.id === dbS.session_id);
        return {
          ...dbS,
          status: live ? live.status.toLowerCase() : 'disconnected',
          live_status: live ? live.status : 'DISCONNECTED',
          qr: live?.qr,
          user: live?.user
        };
      });

      res.json(merged);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  });

  app.post('/api/admin/sessions/init', superAdminAuth, async (req, res) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

      if (connectingSessions.has(sessionId)) {
        return res.json({ success: true, message: 'Already initializing' });
      }

      connectToWhatsApp(sessionId).catch(err => {
        console.error(`[WhatsApp] REST init failed for ${sessionId}:`, err?.message || err);
      });
      res.json({ success: true, message: 'Session initializing' });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to init session' });
    }
  });

  app.post('/api/admin/sessions/restart', superAdminAuth, async (req, res) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

      const oldSession = sessions.get(sessionId);
      if (oldSession?.socket) {
        try { oldSession.socket.end(undefined); } catch (_) {}
      }
      sessions.delete(sessionId);
      connectingSessions.delete(sessionId);

      const authPath = `auth-info-${sessionId}`;
      const fs = await import('fs');
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
      }

      io.emit('session-status', { sessionId, status: 'DISCONNECTED', message: 'Restarting...' });
      
      setTimeout(() => {
        connectToWhatsApp(sessionId).catch(err => {
          console.error(`[WhatsApp] Restart failed for ${sessionId}:`, err?.message || err);
        });
      }, 1000);

      res.json({ success: true, message: 'Session restart triggered' });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to restart session' });
    }
  });

  app.delete('/api/admin/sessions/:sessionId', superAdminAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = sessions.get(sessionId);
      if (session?.socket) {
        try { session.socket.end(undefined); } catch (_) {}
      }
      sessions.delete(sessionId);
      
      const authPath = `auth-info-${sessionId}`;
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

  // ─── Admin: Automations ──────────────────────────────────────────
  app.get('/api/admin/automations', adminAuth, async (req, res) => {
    try {
      const { salon_id } = req.query;
      let sql = `SELECT a.*, sl.name as salon_name FROM automations a JOIN salons sl ON a.salon_id = sl.id WHERE 1=1`;
      const params: any[] = [];
      if (salon_id) { sql += ' AND a.salon_id = ?'; params.push(Number(salon_id)); }
      sql += ' ORDER BY a.created_at DESC';
      const rows = await query(sql, params);
      res.json(rows);
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch automations' });
    }
  });

  app.post('/api/admin/automations', adminAuth, async (req, res) => {
    try {
      const { salon_id, trigger_type, action_type, action_config, is_active } = req.body;
      if (!salon_id || !trigger_type || !action_type) return res.status(400).json({ error: 'salon_id, trigger_type, action_type required' });
      const r: any = await query(
        `INSERT INTO automations (salon_id, trigger_type, action_type, action_config, is_active) VALUES (?,?,?,?,?)`,
        [salon_id, trigger_type, action_type, action_config ? JSON.stringify(action_config) : null, is_active !== false]
      );
      res.json({ success: true, id: r.insertId });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to create automation' });
    }
  });

  app.put('/api/admin/automations/:id', adminAuth, async (req, res) => {
    try {
      const { trigger_type, action_type, action_config, is_active } = req.body;
      await query(
        `UPDATE automations SET trigger_type=?, action_type=?, action_config=?, is_active=? WHERE id=?`,
        [trigger_type, action_type, action_config ? JSON.stringify(action_config) : null, is_active !== false, req.params.id]
      );
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update automation' });
    }
  });

  app.delete('/api/admin/automations/:id', adminAuth, async (req, res) => {
    try {
      await query('DELETE FROM automations WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete automation' });
    }
  });

  // ─── Admin: Finances (Platform-wide) ──────────────────────────────
  app.get('/api/admin/finances', adminAuth, async (req, res) => {
    try {
      const { salon_id } = req.query;
      let revSql = `SELECT COALESCE(SUM(s.price), 0) as total FROM appointments a
                    JOIN services s ON a.service_id = s.id
                    WHERE a.status = 'completed'`;
      let expSql = `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE 1=1`;
      const revParams: any[] = [];
      const expParams: any[] = [];
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

  app.post('/api/admin/admins', superAdminAuth, async (req, res) => {
    try {
      const { name, email, password, role } = req.body;
      if (!name || !email || !password) return res.status(400).json({ error: 'Name, email aur password required' });
      if (!['admin', 'support', 'viewer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
      const id = await createAdmin({ name, email, password, role });
      res.json({ success: true, id });
    } catch (e: any) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email already exists' });
      res.status(500).json({ error: 'Failed to create admin' });
    }
  });

  app.put('/api/admin/admins/:id', superAdminAuth, async (req, res) => {
    try {
      const { name, email, role, is_active } = req.body;
      await updateAdmin(Number(req.params.id), { name, email, role, is_active });
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update admin' });
    }
  });

  app.delete('/api/admin/admins/:id', superAdminAuth, async (req, res) => {
    try {
      await deleteAdmin(Number(req.params.id));
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Admin Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete admin' });
    }
  });
}
