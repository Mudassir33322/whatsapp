import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query, getBarbersBySalon, getBarberSchedule, getAvailableSlots, getAppointmentsByBarberAndDate, getOffersBySalon, getSalonReviews, getServicesBySalon, getSalonDetailForBot, getCustomerByPhone, getAllSeats, upsertSeat, deleteSeat, getAllProducts, upsertProduct, upsertSalonMedia, deleteSalonMedia, setSalonCoverImage, clockInBarber, clockOutBarber, getTodayAttendance, getAttendanceHistory, getSalonCustomerChats, getChatMessages, saveChatMessage } from './db';
import { getWASocket } from './notification-service';

const JWT_SECRET = process.env.JWT_SECRET || 'salonlink-super-secret-key-change-in-prod';

interface JwtPayload {
  salonId: number;
  email: string;
}

function authMiddleware(req: any, res: any, next: any) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET) as JwtPayload;
    req.salonId = decoded.salonId;
    req.salonEmail = decoded.email;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function setupSalonRoutes(app: express.Application) {
  // ─── Auth ──────────────────────────────────────────────────────────
  app.post('/api/salon/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email aur password required hai' });

      const rows: any = await query('SELECT * FROM salons WHERE email = ? AND status = "active"', [email]);
      if (rows.length === 0) return res.status(401).json({ error: 'Invalid email ya password' });

      const salon = rows[0];

      let isValid = false;
      if (salon.password) {
        if (salon.password.startsWith('$2')) {
          isValid = await bcrypt.compare(password, salon.password);
        } else {
          // Migrate plaintext password to hash
          isValid = salon.password === password;
          if (isValid) {
            const hash = await bcrypt.hash(password, 10);
            await query('UPDATE salons SET password = ? WHERE id = ?', [hash, salon.id]);
          }
        }
      }

      if (!isValid) return res.status(401).json({ error: 'Invalid email ya password' });

      const token = jwt.sign({ salonId: salon.id, email: salon.email }, JWT_SECRET, { expiresIn: '24h' });
      res.json({
        token,
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

  app.get('/api/salon/auth/me', authMiddleware, async (req: any, res) => {
    try {
      const rows: any = await query('SELECT id, name, email, owner_name, phone, address, cover_image, logo, rating, review_count, description FROM salons WHERE id = ?', [req.salonId]);
      if (rows.length === 0) return res.status(404).json({ error: 'Salon not found' });
      res.json(rows[0]);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch salon' });
    }
  });

  app.post('/api/salon/auth/update-password', authMiddleware, async (req: any, res) => {
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
  app.get('/api/salon/seats', authMiddleware, async (req: any, res) => {
    try {
      const seats = await getAllSeats(req.salonId);
      res.json(seats);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch seats' });
    }
  });

  app.post('/api/salon/seats', authMiddleware, async (req: any, res) => {
    try {
      const { name, status, assigned_staff_id } = req.body;
      if (!name) return res.status(400).json({ error: 'Name required' });
      await upsertSeat({ salon_id: req.salonId, name, status, assigned_staff_id });
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to save seat' });
    }
  });

  app.put('/api/salon/seats/:id', authMiddleware, async (req: any, res) => {
    try {
      const { name, status, assigned_staff_id } = req.body;
      await upsertSeat({ id: Number(req.params.id), salon_id: req.salonId, name, status, assigned_staff_id });
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update seat' });
    }
  });

  app.delete('/api/salon/seats/:id', authMiddleware, async (req: any, res) => {
    try {
      await deleteSeat(Number(req.params.id));
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete seat' });
    }
  });

  // ─── Inventory / Products CRUD ──────────────────────────────────
  app.get('/api/salon/products', authMiddleware, async (req: any, res) => {
    try {
      const products = await getAllProducts(req.salonId);
      res.json(products);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  app.post('/api/salon/products', authMiddleware, async (req: any, res) => {
    try {
      const { id, name, price, stock, min_stock, unit } = req.body;
      if (!name || !price) return res.status(400).json({ error: 'Name aur price required' });
      await upsertProduct({ id, salon_id: req.salonId, name, price, stock, min_stock, unit });
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to save product' });
    }
  });

  app.delete('/api/salon/products/:id', authMiddleware, async (req: any, res) => {
    try {
      await query('DELETE FROM products WHERE id = ? AND salon_id = ?', [req.params.id, req.salonId]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete product' });
    }
  });

  // ─── Dashboard ─────────────────────────────────────────────────────
  app.get('/api/salon/dashboard', authMiddleware, async (req: any, res) => {
    try {
      const sid = req.salonId;
      const today = new Date().toISOString().split('T')[0];

      const todayAppts: any = await query(
        `SELECT COUNT(*) as total FROM appointments WHERE salon_id = ? AND appointment_date = ? AND status NOT IN ('cancelled','no_show')`,
        [sid, today]
      );
      const todayCompleted: any = await query(
        `SELECT COUNT(*) as total FROM appointments WHERE salon_id = ? AND appointment_date = ? AND status = 'completed'`,
        [sid, today]
      );
      const todayPending: any = await query(
        `SELECT COUNT(*) as total FROM appointments WHERE salon_id = ? AND appointment_date = ? AND status = 'confirmed'`,
        [sid, today]
      );
      const totalBarbers: any = await query(
        `SELECT COUNT(*) as total FROM barbers WHERE salon_id = ? AND status = 'active'`,
        [sid]
      );
      const totalCustomers: any = await query(
        `SELECT COUNT(DISTINCT customer_phone) as total FROM appointments WHERE salon_id = ?`,
        [sid]
      );
      const totalAppts: any = await query(
        `SELECT COUNT(*) as total FROM appointments WHERE salon_id = ?`,
        [sid]
      );

      const todaySchedule: any = await query(
        `SELECT a.*, b.name as barber_name, s.name as service_name 
         FROM appointments a 
         JOIN barbers b ON a.barber_id = b.id 
         JOIN services s ON a.service_id = s.id 
         WHERE a.salon_id = ? AND a.appointment_date = ? 
         ORDER BY a.appointment_time`,
        [sid, today]
      );

      const revenueToday: any = await query(
        `SELECT COALESCE(SUM(s.price), 0) as total FROM appointments a 
         JOIN services s ON a.service_id = s.id 
         WHERE a.salon_id = ? AND a.appointment_date = ? AND a.status = 'completed'`,
        [sid, today]
      );

      const recentLeads: any = await query(
        `SELECT pv.*, c.name as customer_name, c.last_status, b.name as barber_name
         FROM profile_visits pv
         LEFT JOIN customers c ON pv.customer_phone = c.phone
         LEFT JOIN barbers b ON pv.barber_id = b.id
         WHERE pv.salon_id = ?
         ORDER BY pv.visit_time DESC LIMIT 10`,
        [sid]
      );

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

  app.get('/api/salon/leads', authMiddleware, async (req: any, res) => {
    try {
      const rows: any = await query(
        `SELECT pv.*, c.name as customer_name, c.last_status, b.name as barber_name
         FROM profile_visits pv
         LEFT JOIN customers c ON pv.customer_phone = c.phone
         LEFT JOIN barbers b ON pv.barber_id = b.id
         WHERE pv.salon_id = ?
         ORDER BY pv.visit_time DESC LIMIT 50`,
        [req.salonId]
      );
      res.json(rows);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch leads' });
    }
  });

  // ─── Barbers CRUD ─────────────────────────────────────────────────
  app.get('/api/salon/barbers', authMiddleware, async (req: any, res) => {
    try {
      const barbers = await getBarbersBySalon(req.salonId);
      res.json(barbers);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch barbers' });
    }
  });

  app.post('/api/salon/barbers', authMiddleware, async (req: any, res) => {
    try {
      const { name, phone, email, bio, experience, specialization, profile_image } = req.body;
      if (!name) return res.status(400).json({ error: 'Name required' });
      // Auto-generate 4-digit PIN
      const pin = String(Math.floor(1000 + Math.random() * 9000));
      const r: any = await query(
        `INSERT INTO barbers (salon_id, name, phone, email, bio, experience, specialization, profile_image, pin_code) VALUES (?,?,?,?,?,?,?,?,?)`,
        [req.salonId, name, phone || null, email || null, bio || null, experience || 0, specialization || null, profile_image || null, pin]
      );
      res.json({ success: true, id: r.insertId, pin_code: pin });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to create barber' });
    }
  });

  app.put('/api/salon/barbers/:id', authMiddleware, async (req: any, res) => {
    try {
      const { name, phone, email, bio, experience, specialization, profile_image, status } = req.body;
      await query(
        `UPDATE barbers SET name=?, phone=?, email=?, bio=?, experience=?, specialization=?, profile_image=?, status=? WHERE id=? AND salon_id=?`,
        [name, phone || null, email || null, bio || null, experience || 0, specialization || null, profile_image || null, status || 'active', req.params.id, req.salonId]
      );
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update barber' });
    }
  });

  app.delete('/api/salon/barbers/:id', authMiddleware, async (req: any, res) => {
    try {
      await query('DELETE FROM barbers WHERE id = ? AND salon_id = ?', [req.params.id, req.salonId]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete barber' });
    }
  });

  // Barber Schedule
  app.get('/api/salon/barbers/:id/schedule', authMiddleware, async (req: any, res) => {
    try {
      const schedule = await getBarberSchedule(Number(req.params.id));
      res.json(schedule);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch schedule' });
    }
  });

  app.put('/api/salon/barbers/:id/schedule', authMiddleware, async (req: any, res) => {
    try {
      const { schedule } = req.body; // array of { day_of_week, start_time, end_time, slot_duration, is_available }
      if (!Array.isArray(schedule)) return res.status(400).json({ error: 'Schedule array required' });

      // Delete existing + re-insert
      await query('DELETE FROM barber_schedule WHERE barber_id = ?', [req.params.id]);
      for (const s of schedule) {
        await query(
          `INSERT INTO barber_schedule (barber_id, day_of_week, start_time, end_time, slot_duration, is_available) VALUES (?,?,?,?,?,?)`,
          [req.params.id, s.day_of_week, s.start_time, s.end_time, s.slot_duration || 30, s.is_available !== false]
        );
      }
      res.json({ success: true });
    } catch (e: any) {
      console.error('Schedule error:', e);
      res.status(500).json({ error: 'Failed to update schedule' });
    }
  });

  // ─── Services CRUD ────────────────────────────────────────────────
  app.get('/api/salon/services', authMiddleware, async (req: any, res) => {
    try {
      const services = await getServicesBySalon(req.salonId);
      res.json(services);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch services' });
    }
  });

  app.post('/api/salon/services', authMiddleware, async (req: any, res) => {
    try {
      const { name, description, price, duration, category } = req.body;
      if (!name || !price) return res.status(400).json({ error: 'Name aur price required' });
      const r: any = await query(
        `INSERT INTO services (salon_id, name, description, price, duration, category, is_active) VALUES (?,?,?,?,?,?,TRUE)`,
        [req.salonId, name, description || null, price, duration || 30, category || null]
      );
      res.json({ success: true, id: r.insertId });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to create service' });
    }
  });

  app.put('/api/salon/services/:id', authMiddleware, async (req: any, res) => {
    try {
      const { name, description, price, duration, category, is_active } = req.body;
      await query(
        `UPDATE services SET name=?, description=?, price=?, duration=?, category=?, is_active=? WHERE id=? AND salon_id=?`,
        [name, description || null, price, duration || 30, category || null, is_active !== undefined ? is_active : true, req.params.id, req.salonId]
      );
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update service' });
    }
  });

  app.delete('/api/salon/services/:id', authMiddleware, async (req: any, res) => {
    try {
      await query('DELETE FROM services WHERE id = ? AND salon_id = ?', [req.params.id, req.salonId]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete service' });
    }
  });

  // Link barber to service
  app.post('/api/salon/barber-services', authMiddleware, async (req: any, res) => {
    try {
      const { barber_id, service_id, price } = req.body;
      if (!barber_id || !service_id) return res.status(400).json({ error: 'barber_id aur service_id required' });
      // Verify barber belongs to this salon
      const b: any = await query('SELECT id FROM barbers WHERE id = ? AND salon_id = ?', [barber_id, req.salonId]);
      if (b.length === 0) return res.status(403).json({ error: 'Barber does not belong to your salon' });
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

  app.delete('/api/salon/barber-services', authMiddleware, async (req: any, res) => {
    try {
      const { barber_id, service_id } = req.body;
      await query('DELETE FROM barber_services WHERE barber_id=? AND service_id=?', [barber_id, service_id]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to unlink service' });
    }
  });

  app.get('/api/salon/barber-services/:barberId', authMiddleware, async (req: any, res) => {
    try {
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
  app.get('/api/salon/appointments', authMiddleware, async (req: any, res) => {
    try {
      const { date, barber_id, status } = req.query;
      let sql = `SELECT a.*, b.name as barber_name, s.name as service_name 
                 FROM appointments a 
                 JOIN barbers b ON a.barber_id = b.id 
                 JOIN services s ON a.service_id = s.id 
                 WHERE a.salon_id = ?`;
      const params: any[] = [req.salonId];

      if (date) { sql += ' AND a.appointment_date = ?'; params.push(date); }
      if (barber_id) { sql += ' AND a.barber_id = ?'; params.push(Number(barber_id)); }
      if (status) { sql += ' AND a.status = ?'; params.push(status); }

      sql += ' ORDER BY a.appointment_date DESC, a.appointment_time ASC';
      const rows = await query(sql, params);
      res.json(rows);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch appointments' });
    }
  });

  app.put('/api/salon/appointments/:id/status', authMiddleware, async (req: any, res) => {
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

  // ─── Working Hours ────────────────────────────────────────────────
  app.get('/api/salon/working-hours', authMiddleware, async (req: any, res) => {
    try {
      const rows: any = await query('SELECT * FROM working_hours WHERE salon_id = ? ORDER BY day_of_week', [req.salonId]);
      res.json(rows);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch working hours' });
    }
  });

  app.put('/api/salon/working-hours', authMiddleware, async (req: any, res) => {
    try {
      const { hours } = req.body; // array of { day_of_week, start_time, end_time, is_off }
      if (!Array.isArray(hours)) return res.status(400).json({ error: 'Hours array required' });

      await query('DELETE FROM working_hours WHERE salon_id = ?', [req.salonId]);
      for (const h of hours) {
        await query(
          `INSERT INTO working_hours (salon_id, day_of_week, start_time, end_time, is_off) VALUES (?,?,?,?,?)`,
          [req.salonId, h.day_of_week, h.start_time, h.end_time, h.is_off || false]
        );
      }
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update working hours' });
    }
  });

  // ─── Offers CRUD ──────────────────────────────────────────────────
  app.get('/api/salon/offers', authMiddleware, async (req: any, res) => {
    try {
      const offers = await getOffersBySalon(req.salonId);
      // Also include expired/inactive ones for management
      const allOffers: any = await query('SELECT * FROM offers WHERE salon_id = ? ORDER BY created_at DESC', [req.salonId]);
      res.json(allOffers);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch offers' });
    }
  });

  app.post('/api/salon/offers', authMiddleware, async (req: any, res) => {
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

  app.put('/api/salon/offers/:id', authMiddleware, async (req: any, res) => {
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

  app.delete('/api/salon/offers/:id', authMiddleware, async (req: any, res) => {
    try {
      await query('DELETE FROM offers WHERE id = ? AND salon_id = ?', [req.params.id, req.salonId]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete offer' });
    }
  });

  // ─── Reviews ──────────────────────────────────────────────────────
  app.get('/api/salon/reviews', authMiddleware, async (req: any, res) => {
    try {
      const reviews = await getSalonReviews(req.salonId, 50);
      res.json(reviews);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch reviews' });
    }
  });

  // ─── Customers ────────────────────────────────────────────────────
  app.get('/api/salon/customers', authMiddleware, async (req: any, res) => {
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

  app.get('/api/salon/customers/:phone', authMiddleware, async (req: any, res) => {
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

  // ─── Salon Customer Chats ─────────────────────────────────────────
  app.get('/api/salon/chats', authMiddleware, async (req: any, res) => {
    try {
      const contacts = await getSalonCustomerChats(req.salonId);
      res.json(contacts);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch chats' });
    }
  });

  app.get('/api/salon/chats/:phone/messages', authMiddleware, async (req: any, res) => {
    try {
      const messages = await getChatMessages(req.params.phone);
      res.json(messages);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  app.post('/api/salon/chats/:phone/send', authMiddleware, async (req: any, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: 'Message required' });
      const phone = req.params.phone;
      const fullPhone = phone.includes('@s.whatsapp.net') ? phone : `${phone}@s.whatsapp.net`;
      const sock = getWASocket();
      if (!sock) return res.status(500).json({ error: 'WhatsApp not connected' });
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
  app.get('/api/salon/analytics', authMiddleware, async (req: any, res) => {
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

  // ─── Settings ─────────────────────────────────────────────────────
  app.get('/api/salon/settings', authMiddleware, async (req: any, res) => {
    try {
      const rows: any = await query(
        `SELECT id, name, owner_name, phone, email, address, description, cover_image, logo, latitude, longitude FROM salons WHERE id = ?`,
        [req.salonId]
      );
      res.json(rows[0] || {});
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  });

  app.put('/api/salon/settings', authMiddleware, async (req: any, res) => {
    try {
      const { name, owner_name, phone, address, description, cover_image, logo, latitude, longitude } = req.body;
      await query(
        `UPDATE salons SET name=?, owner_name=?, phone=?, address=?, description=?, cover_image=?, logo=?, latitude=?, longitude=? WHERE id=?`,
        [name, owner_name, phone, address, description, cover_image, logo, latitude || null, longitude || null, req.salonId]
      );
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  // ─── Finances (Own Salon) ──────────────────────────────────────────
  app.get('/api/salon/finances', authMiddleware, async (req: any, res) => {
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

  // ─── Notification Preferences ────────────────────────────────────
  app.get('/api/salon/notification-preferences', authMiddleware, async (req: any, res) => {
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

  app.put('/api/salon/notification-preferences', authMiddleware, async (req: any, res) => {
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

  // ─── Salon Media / Gallery ──────────────────────────────────────
  app.get('/api/salon/media', authMiddleware, async (req: any, res) => {
    try {
      const rows = await query('SELECT * FROM salon_media WHERE salon_id = ? ORDER BY is_cover DESC, display_order DESC, created_at DESC', [req.salonId]);
      res.json(rows);
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch media' });
    }
  });

  app.post('/api/salon/media', authMiddleware, async (req: any, res) => {
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

  app.delete('/api/salon/media/:id', authMiddleware, async (req: any, res) => {
    try {
      await deleteSalonMedia(parseInt(req.params.id));
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to delete media' });
    }
  });

  app.put('/api/salon/media/:id/cover', authMiddleware, async (req: any, res) => {
    try {
      await setSalonCoverImage(req.salonId, parseInt(req.params.id));
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to set cover' });
    }
  });

  // ─── Walk-in Entry ──────────────────────────────────────────────
  app.post('/api/salon/walkin', authMiddleware, async (req: any, res) => {
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
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let token = '#';
      for (let i = 0; i < 5; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
      // Upsert customer
      if (name) {
        await query('INSERT INTO customers (phone, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = ?', [phone, name, name]);
      }
      // Create appointment
      let assignedBarber = barber_id || null;
      if (!assignedBarber) {
        // Assign first available barber
        const barbers: any = await getBarbersBySalon(req.salonId);
        if (barbers.length > 0) assignedBarber = barbers[0].id;
      }
      await query(
        `INSERT INTO appointments (salon_id, barber_id, customer_phone, service_id, appointment_date, appointment_time, end_time, token, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
        [req.salonId, assignedBarber, phone, service_id, appointment_date, appointment_time, end_time, token]
      );
      res.json({ success: true, token, end_time, barber_id: assignedBarber });
    } catch (e: any) {
      console.error('[Salon Route Error]', e?.message || e);
      res.status(500).json({ error: 'Walk-in failed: ' + e.message });
    }
  });

  // ─── Barber Attendance ──────────────────────────────────────────
  // GET /api/salon/barbers to view barbers with their PINs (already exists)
  // We reuse that, but add PIN in the response

  // POST /api/salon/attendance/clockin — { barber_id, pin_code }
  app.post('/api/salon/attendance/clockin', authMiddleware, async (req: any, res) => {
    try {
      const { barber_id, pin_code } = req.body;
      if (!barber_id || !pin_code) return res.status(400).json({ error: 'barber_id and pin_code required' });
      const result = await clockInBarber(barber_id, req.salonId, pin_code, 'portal');
      if (!result.success) return res.status(400).json({ error: result.error });
      res.json({ success: true, message: 'Clocked in!' });
    } catch (e: any) { console.error('[Salon Route Error]', e?.message || e); res.status(500).json({ error: e.message }); }
  });

  // POST /api/salon/attendance/clockout — { barber_id, pin_code }
  app.post('/api/salon/attendance/clockout', authMiddleware, async (req: any, res) => {
    try {
      const { barber_id, pin_code } = req.body;
      if (!barber_id || !pin_code) return res.status(400).json({ error: 'barber_id and pin_code required' });
      const result = await clockOutBarber(barber_id, req.salonId, pin_code);
      if (!result.success) return res.status(400).json({ error: result.error });
      res.json({ success: true, message: 'Clocked out!' });
    } catch (e: any) { console.error('[Salon Route Error]', e?.message || e); res.status(500).json({ error: e.message }); }
  });

  // GET /api/salon/attendance/today — view today's attendance
  app.get('/api/salon/attendance/today', authMiddleware, async (req: any, res) => {
    try {
      const rows = await getTodayAttendance(req.salonId);
      res.json(rows);
    } catch (e: any) { console.error('[Salon Route Error]', e?.message || e); res.status(500).json({ error: e.message }); }
  });

  // GET /api/salon/attendance/history?days=30
  app.get('/api/salon/attendance/history', authMiddleware, async (req: any, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const rows = await getAttendanceHistory(req.salonId, days);
      res.json(rows);
    } catch (e: any) { console.error('[Salon Route Error]', e?.message || e); res.status(500).json({ error: e.message }); }
  });

  // Barber PIN auto-generate on create (update existing POST /api/salon/barbers)
  // Also add endpoint to set/reset PIN
  app.post('/api/salon/barbers/:id/pin', authMiddleware, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { pin_code } = req.body;
      if (!pin_code || pin_code.length !== 4) return res.status(400).json({ error: 'PIN must be 4 digits' });
      await query('UPDATE barbers SET pin_code = ? WHERE id = ? AND salon_id = ?', [pin_code, id, req.salonId]);
      res.json({ success: true });
    } catch (e: any) { console.error('[Salon Route Error]', e?.message || e); res.status(500).json({ error: e.message }); }
  });
}
