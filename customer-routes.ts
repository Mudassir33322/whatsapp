import crypto from 'crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import { query, getCustomerByPhone, getCustomerPasswordHash, updateCustomerPassword, getAvailableSlots, createAppointment, getBarbersBySalon, createPendingBooking } from './db';
import { getWASocket, isSessionConnected } from './notification-service';
import { phoneSchema, validatePassword, sanitizeString } from './security';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from './auth-helper';
import { normalizePhone } from './utils';
import { customerAuth, CustomerRequest, parseId } from './middleware';

const otpAttempts = new Map<string, { count: number; blockedUntil: number }>();
const otpCooldowns = new Map<string, number>();

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function otpRateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const attempt = otpAttempts.get(key);
  if (attempt && attempt.blockedUntil > now) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }
  const lastSent = otpCooldowns.get(key);
  if (lastSent && now - lastSent < 30000) {
    return res.status(429).json({ error: 'Please wait 30 seconds before trying again.' });
  }
  next();
}

function generateOtp(): string {
  const buf = crypto.randomBytes(3);
  const num = buf.readUIntBE(0, 3) % 900000 + 100000;
  return String(num);
}

async function ensureCustomerColumns() {
  if (process.env.USE_SQLITE === 'true') return;
  try {
    const dbName = process.env.DB_NAME || 'autozap_platform';
    const check: any = await query(
      "SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'email'",
      [dbName]
    );
    if (check[0]?.cnt === 0) {
      await query("ALTER TABLE customers ADD COLUMN email VARCHAR(100) DEFAULT NULL AFTER name");
    }
    const pwdCheck: any = await query(
      "SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'password_hash'",
      [dbName]
    );
    if (pwdCheck[0]?.cnt === 0) {
      await query("ALTER TABLE customers ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL AFTER email");
      await query("ALTER TABLE customers ADD COLUMN has_set_password TINYINT(1) DEFAULT 0 AFTER password_hash");
    }
  } catch (_) {}
}

export function setupCustomerRoutes(app: express.Application) {
  ensureCustomerColumns();

  const otpAttempts = new Map<string, { count: number; blockedUntil: number }>();
  const otpSendCooldown = new Map<string, number>();

  app.post('/api/customer/auth/login', otpRateLimit, async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone) return res.status(400).json({ error: 'Phone required' });
      const phoneResult = phoneSchema.safeParse(normalizePhone(phone));
      if (!phoneResult.success) return res.status(400).json({ error: 'Please enter a valid phone number' });

      const cleanPhone = normalizePhone(phone);
      const now = Date.now();
      const attempt = otpAttempts.get(cleanPhone);
      if (attempt && attempt.blockedUntil > now) {
        const remaining = Math.ceil((attempt.blockedUntil - now) / 1000);
        return res.status(429).json({ error: `Too many attempts. Try again in ${remaining} seconds` });
      }
      const lastSent = otpSendCooldown.get(cleanPhone);
      if (lastSent && now - lastSent < 30000) {
        return res.status(429).json({ error: 'Please wait a few seconds before trying again' });
      }
      otpSendCooldown.set(cleanPhone, now);
      let customer = await getCustomerByPhone(cleanPhone);

      if (!customer) {
        await query(
          'INSERT INTO customers (phone, name) VALUES (?, ?)',
          [cleanPhone, cleanPhone]
        );
        customer = await getCustomerByPhone(cleanPhone);
      } else {
        await query(
          'UPDATE customers SET name = COALESCE(NULLIF(?, ""), name) WHERE phone = ?',
          [cleanPhone, cleanPhone]
        );
      }

      const code = generateOtp();
      const codeHash = hashOtp(code);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await query(
        'INSERT INTO customer_otps (phone, code, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE code = VALUES(code), expires_at = VALUES(expires_at)',
        [cleanPhone, codeHash, expiresAt]
      );

      // Send OTP via WhatsApp
      let otpSent = false;
      try {
        const sock = getWASocket();
        if (sock) {
          await sock.sendMessage(cleanPhone + '@s.whatsapp.net', { text: `🔐 *AutoZap* OTP Code\n\nAapka verification code hai:\n*${code}*\n\nYe code 5 minute mein expire ho jayega.` });
          console.log(`[Customer OTP] Sent via WhatsApp to ${cleanPhone}`);
          otpSent = true;
        } else {
          console.log(`[Customer OTP] WhatsApp not connected for ${cleanPhone}`);
        }
      } catch (waErr) {
        console.log(`[Customer OTP] WhatsApp send failed for ${cleanPhone}`, waErr);
      }

      if (!otpSent) {
        return res.status(503).json({ error: 'WhatsApp is not connected. Please initialize WhatsApp session first.' });
      }
      res.json({
        success: true,
        message: 'OTP has been sent to your WhatsApp',
      });
    } catch (e: any) {
      console.error('[Customer Route Error]', e?.message || e);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.post('/api/customer/auth/verify-otp', async (req, res) => {
    try {
      const { phone, code } = req.body;
      if (!phone || !code) return res.status(400).json({ error: 'Phone and code are required' });

      const cleanPhone = normalizePhone(phone);
      const now = Date.now();
      const attempt = otpAttempts.get(cleanPhone) || { count: 0, blockedUntil: 0 };
      if (attempt.blockedUntil > now) {
        const remaining = Math.ceil((attempt.blockedUntil - now) / 1000);
        return res.status(429).json({ error: `Too many attempts. Try again in ${remaining} seconds` });
      }
      attempt.count++;
      if (attempt.count >= 5) {
        attempt.blockedUntil = now + 15 * 60 * 1000;
        attempt.count = 0;
      }
      otpAttempts.set(cleanPhone, attempt);

      // Security: Prevent backdoor access via phone suffix
      if (cleanPhone.endsWith('0000')) {
        return res.status(401).json({ error: 'Invalid phone number format' });
      }

      const rows: any = await query(
        'SELECT code, expires_at FROM customer_otps WHERE phone = ?',
        [cleanPhone]
      );
      if (rows.length === 0) return res.status(401).json({ error: 'Please request an OTP first' });

      const stored = rows[0];
      const inputHash = hashOtp(code);
      const isExpired = new Date(stored.expires_at) < new Date();
      if (stored.code !== inputHash || isExpired) {
        return res.status(401).json({ error: 'Invalid ya expired code' });
      }
      const otpValid = await bcrypt.compare(code, stored.code);
      if (!otpValid || new Date(stored.expires_at) < new Date()) {
        return res.status(401).json({ error: 'Invalid ya expired code' });
      }

      await query('DELETE FROM customer_otps WHERE phone = ?', [cleanPhone]);

      const customer = await getCustomerByPhone(cleanPhone);
      if (!customer) return res.status(404).json({ error: 'Customer not found' });

      const accessToken = generateAccessToken({ customerPhone: cleanPhone, type: 'customer' });
      const refreshToken = generateRefreshToken({ customerPhone: cleanPhone, type: 'customer' });

      res.json({
        token: accessToken,
        refreshToken,
        needsPassword: !customer.has_set_password,
        customer: {
          phone: customer.phone,
          name: customer.name || '',
          email: customer.email || '',
          loyalty_points: customer.loyalty_points || 0
        }
      });
    } catch (e: any) {
      console.error('[Customer Route Error]', e?.message || e);
      res.status(500).json({ error: 'Verification failed' });
    }
  });

  app.post('/api/customer/auth/set-password', customerAuth, async (req: CustomerRequest, res) => {
    try {
      if (!req.customerPhone) return res.status(401).json({ error: 'Unauthorized' });
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ error: 'Password is required' });
      }
      const passwordError = validatePassword(password);
      if (passwordError) {
        return res.status(400).json({ error: passwordError });
      }
      const customer = await getCustomerByPhone(req.customerPhone);
      if (!customer) return res.status(404).json({ error: 'Customer not found' });
      const hash = await bcrypt.hash(password, 10);
      await updateCustomerPassword(req.customerPhone, hash);
      res.json({ success: true, message: 'Password successfully set kiya gaya' });
    } catch (e: any) {
      console.error('[Customer Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to set password' });
    }
  });

  app.post('/api/customer/auth/change-password', customerAuth, async (req: CustomerRequest, res) => {
    try {
      if (!req.customerPhone) return res.status(401).json({ error: 'Unauthorized' });
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are both required' });
      }
      const passwordError = validatePassword(newPassword);
      if (passwordError) {
        return res.status(400).json({ error: passwordError });
      }
      const customer = await getCustomerByPhone(req.customerPhone);
      if (!customer) return res.status(404).json({ error: 'Customer not found' });
      const hash = await getCustomerPasswordHash(req.customerPhone);
      if (!hash) {
        return res.status(400).json({ error: 'Password is not set. Please login with OTP and set a password first.' });
      }
      const valid = await bcrypt.compare(currentPassword, hash);
      if (!valid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      const newHash = await bcrypt.hash(newPassword, 10);
      await updateCustomerPassword(req.customerPhone, newHash);
      res.json({ success: true, message: 'Password changed successfully' });
    } catch (e: any) {
      console.error('[Customer Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to change password' });
    }
  });

  app.post('/api/customer/auth/login-password', async (req, res) => {
    try {
      const { phone, password } = req.body;
      if (!phone || !password) return res.status(400).json({ error: 'Phone and password are required' });
      const phoneResult = phoneSchema.safeParse(phone.replace('@s.whatsapp.net', ''));
      if (!phoneResult.success) return res.status(400).json({ error: 'Please enter a valid phone number' });
      const cleanPhone = normalizePhone(phone);
      const hash = await getCustomerPasswordHash(cleanPhone);
      if (!hash) return res.status(401).json({ error: 'Password is not set. Please login with OTP first.' });
      const valid = await bcrypt.compare(password, hash);
      if (!valid) return res.status(401).json({ error: 'Phone or password is incorrect' });
      const customer = await getCustomerByPhone(cleanPhone);
      if (!customer) return res.status(404).json({ error: 'Customer not found' });
      const accessToken = generateAccessToken({ customerPhone: cleanPhone, type: 'customer' });
      const refreshToken = generateRefreshToken({ customerPhone: cleanPhone, type: 'customer' });
      res.json({
        token: accessToken,
        refreshToken,
        customer: {
          phone: customer.phone,
          name: customer.name || '',
          email: customer.email || '',
          loyalty_points: customer.loyalty_points || 0
        }
      });
    } catch (e: any) {
      console.error('[Customer Route Error]', e?.message || e);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.get('/api/customer/auth/me', customerAuth, async (req: any, res) => {
    try {
      const customer = await getCustomerByPhone(req.customerPhone);
      if (!customer) return res.status(404).json({ error: 'Customer not found' });

      res.json({
        phone: customer.phone,
        name: customer.name || '',
        email: customer.email || '',
        loyalty_points: customer.loyalty_points || 0
      });
    } catch (e: any) {
      console.error('[Customer Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  });

  app.post('/api/customer/auth/refresh', async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });
      const decoded = verifyRefreshToken(refreshToken);
      if (!decoded) return res.status(401).json({ error: 'Invalid or expired refresh token' });
      const accessToken = generateAccessToken({ customerPhone: decoded.customerPhone, type: 'customer' });
      res.json({ token: accessToken });
    } catch (e: any) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
  });

  app.get('/api/customer/appointments', customerAuth, async (req: any, res) => {
    try {
      const rows: any = await query(
        `SELECT a.*, s.name as service_name, sl.name as salon_name, a.recurring_booking_id, rb.frequency
         FROM appointments a
         JOIN services s ON a.service_id = s.id
         JOIN salons sl ON a.salon_id = sl.id
         LEFT JOIN recurring_bookings rb ON a.recurring_booking_id = rb.id
         WHERE a.customer_phone = ?
         ORDER BY a.appointment_date DESC`,
        [req.customerPhone]
      );
      res.json(rows);
    } catch (e: any) {
      console.error('[Customer Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch appointments' });
    }
  });

  app.put('/api/customer/appointments/:id/cancel', customerAuth, async (req: any, res) => {
    try {
      const rows: any = await query(
        'SELECT id, status FROM appointments WHERE id = ? AND customer_phone = ?',
        [req.params.id, req.customerPhone]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
      if (!['pending', 'confirmed'].includes(rows[0].status)) {
        return res.status(400).json({ error: 'Cannot cancel this appointment' });
      }
      await query('UPDATE appointments SET status = ? WHERE id = ?', ['cancelled', req.params.id]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Customer Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to cancel appointment' });
    }
  });

  app.put('/api/customer/profile', customerAuth, async (req: any, res) => {
    try {
      const { name, email } = req.body;
      if (!name && !email) return res.status(400).json({ error: 'Name ya email required' });

      const sets: string[] = [];
      const params: any[] = [];
      if (name !== undefined) { sets.push('name = ?'); params.push(name); }
      if (email !== undefined) { sets.push('email = ?'); params.push(email); }
      params.push(req.customerPhone);
      await query(`UPDATE customers SET ${sets.join(', ')} WHERE phone = ?`, params);

      const customer = await getCustomerByPhone(req.customerPhone);
      res.json({
        success: true,
        customer: {
          phone: customer.phone,
          name: customer.name || '',
          email: customer.email || '',
          loyalty_points: customer.loyalty_points || 0
        }
      });
    } catch (e: any) {
      console.error('[Customer Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  app.get('/api/customer/salons', async (req, res) => {
    try {
      const rows: any = await query(
        `SELECT id, name, phone, address, cover_image_url as cover_image, logo_url as logo, rating, review_count
         FROM salons WHERE status = 'active' ORDER BY name`
      );
      res.json(rows);
    } catch (e: any) {
      console.error('[Customer Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch salons' });
    }
  });

  app.get('/api/customer/salons/:id', async (req, res) => {
    try {
      const salonId = parseId(req.params.id);
      if (salonId === null) return res.status(400).json({ error: 'Invalid salon ID' });
      const salons: any = await query(
        `SELECT s.id, s.name, s.owner_name, s.phone, s.email, s.country_id, s.city_id, s.area_id,
                s.address, s.description, s.cover_image_url, s.logo_url, s.status,
                s.rating, s.review_count, s.latitude, s.longitude,
                s.commission_rate, s.commission_type, s.created_at,
                c.name as city_name, ct.name as country_name, a.name as area_name
         FROM salons s
         LEFT JOIN cities c ON s.city_id = c.id
         LEFT JOIN countries ct ON s.country_id = ct.id
         LEFT JOIN areas a ON s.area_id = a.id
         WHERE s.id = ? AND s.status = 'active'`,
        [salonId]
      );
      if (salons.length === 0) return res.status(404).json({ error: 'Salon not found' });

      const services: any = await query(
        'SELECT id, name, description, price, duration, category FROM services WHERE salon_id = ? AND is_active = TRUE ORDER BY name',
        [salonId]
      );

      res.json({ ...salons[0], services });
    } catch (e: any) {
      console.error('[Customer Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch salon' });
    }
  });

  // ── Public Booking Endpoints ──────────────────────────────────────

  function generateBookingToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = crypto.randomBytes(6);
    let token = '';
    for (let i = 0; i < 6; i++) {
      token += chars.charAt(bytes[i] % chars.length);
    }
    return token;
  }

  app.get('/api/customer/locations', async (req, res) => {
    try {
      const countryId = req.query.country_id as string;
      const cityId = req.query.city_id as string;
      const countries = await query('SELECT id, name FROM countries WHERE is_active = TRUE ORDER BY name');
      let cities: any[] = [];
      let areas: any[] = [];
      if (countryId) cities = await query('SELECT id, name FROM cities WHERE country_id = ? AND is_active = TRUE ORDER BY name', [countryId]);
      if (cityId) areas = await query('SELECT id, name FROM areas WHERE city_id = ? AND is_active = TRUE ORDER BY name', [cityId]);
      res.json({ countries, cities, areas });
    } catch (e: any) {
      console.error('[Location Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch locations' });
    }
  });

  app.get('/api/customer/bookable-salons', async (req, res) => {
    try {
      const countryId = req.query.country_id as string;
      const cityId = req.query.city_id as string;
      const areaId = req.query.area_id as string;
      let sql = `SELECT s.id, s.name, s.phone, s.address, s.cover_image_url as cover_image, s.logo_url as logo, s.rating, s.review_count,
                 c.name as city_name, a.name as area_name, co.name as country_name
                 FROM salons s
                 LEFT JOIN cities c ON s.city_id = c.id
                 LEFT JOIN areas a ON s.area_id = a.id
                 LEFT JOIN countries co ON s.country_id = co.id
                 WHERE s.status = 'active'`;
      const params: any[] = [];
      if (areaId) { sql += ' AND s.area_id = ?'; params.push(areaId); }
      else if (cityId) { sql += ' AND s.city_id = ?'; params.push(cityId); }
      else if (countryId) { sql += ' AND s.country_id = ?'; params.push(countryId); }
      sql += ' ORDER BY s.name';
      const rows: any = await query(sql, params);
      res.json(rows);
    } catch (e: any) {
      console.error('[Booking Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch salons' });
    }
  });

  app.get('/api/customer/bookable-salons/:id/services', async (req, res) => {
    try {
      const salonId = parseId(req.params.id);
      if (salonId === null) return res.status(400).json({ error: 'Invalid salon ID' });
      const salons: any = await query("SELECT id, name, address, phone, rating, cover_image_url as cover_image, logo_url as logo FROM salons WHERE id = ? AND status = 'active'", [salonId]);
      if (salons.length === 0) return res.status(404).json({ error: 'Salon not found' });

      const services: any = await query(
        'SELECT id, name, description, price, duration, category FROM services WHERE salon_id = ? AND is_active = TRUE ORDER BY name',
        [salonId]
      );

      const barbers: any = await getBarbersBySalon(salonId);

      res.json({ ...salons[0], services, barbers });
    } catch (e: any) {
      console.error('[Booking Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch salon services' });
    }
  });

  app.get('/api/customer/bookable-salons/:id/slots', async (req, res) => {
    try {
      const salonId = parseId(req.params.id);
      if (salonId === null) return res.status(400).json({ error: 'Invalid salon ID' });
      const date = req.query.date as string;
      const barberId = parseInt(req.query.barber_id as string);
      if (isNaN(barberId)) return res.status(400).json({ error: 'Invalid barber ID' });

      if (!date) {
        return res.status(400).json({ error: 'date is required' });
      }

      const salons: any = await query("SELECT id FROM salons WHERE id = ? AND status = 'active'", [salonId]);
      if (salons.length === 0) return res.status(404).json({ error: 'Salon not found' });

      const barbers: any = await query("SELECT id FROM barbers WHERE id = ? AND salon_id = ? AND status = 'active'", [barberId, salonId]);
      if (barbers.length === 0) return res.status(404).json({ error: 'Barber not found in this salon' });

      const slots = await getAvailableSlots(barberId, date);
      res.json({ slots });
    } catch (e: any) {
      console.error('[Booking Route Error]', e?.message || e);
      res.status(500).json({ error: 'Failed to fetch slots' });
    }
  });

  app.post('/api/customer/bookings', customerAuth, async (req: any, res) => {
    try {
      const { salon_id, service_id, barber_id, appointment_date, appointment_time } = req.body;

      if (!salon_id || !service_id || !barber_id || !appointment_date || !appointment_time) {
        return res.status(400).json({ error: 'salon_id, service_id, barber_id, appointment_date, appointment_time are required' });
      }

      // Validate date is not in the past
      const today = new Date().toISOString().split('T')[0];
      if (appointment_date < today) {
        return res.status(400).json({ error: 'Appointment date cannot be in the past' });
      }

      // Validate service exists and belongs to salon
      const services: any = await query(
        'SELECT id, duration FROM services WHERE id = ? AND salon_id = ? AND is_active = TRUE',
        [service_id, salon_id]
      );
      if (services.length === 0) {
        return res.status(400).json({ error: 'Service not found in this salon' });
      }

      // Validate barber belongs to salon
      const barbers: any = await query(
        "SELECT id FROM barbers WHERE id = ? AND salon_id = ? AND status = 'active'",
        [barber_id, salon_id]
      );
      if (barbers.length === 0) {
        return res.status(400).json({ error: 'Barber not found in this salon' });
      }

      const serviceDuration = services[0].duration;
      const endTime = calculateEndTime(appointment_time, serviceDuration);
      const token = generateBookingToken();

      const sessionId = `salon-${salon_id}`;
      if (!isSessionConnected(sessionId)) {
        await createPendingBooking({
          salon_id,
          customer_phone: req.customerPhone,
          customer_name: req.customerPhone,
          service_id,
          barber_id,
          appointment_date,
          appointment_time,
        });
        return res.status(202).json({
          success: true,
          queued: true,
          message: 'WhatsApp disconnected. Booking queued — we will confirm once connection is restored.'
        });
      }

      const result = await createAppointment({
        salon_id,
        barber_id,
        customer_phone: req.customerPhone,
        service_id,
        appointment_date,
        appointment_time,
        end_time: endTime,
        token,
      });

      if (!result.success) {
        return res.status(409).json({ error: result.error || 'Booking failed' });
      }

      const created: any = await query(
        `SELECT a.*, s.name as service_name, b.name as barber_name, sl.name as salon_name
         FROM appointments a
         JOIN services s ON a.service_id = s.id
         JOIN barbers b ON a.barber_id = b.id
         JOIN salons sl ON a.salon_id = sl.id
         WHERE a.id = ?`,
        [result.id]
      );

      res.status(201).json(created[0]);
    } catch (e: any) {
      console.error('[Booking Route Error]', e?.message || e);
      res.status(500).json({ error: 'Booking failed' });
    }
  });

  const publicBookingAttempts = new Map<string, { count: number; blockedUntil: number }>();

  // Public booking endpoint (no auth required)
  app.post('/api/customer/bookings/public', async (req, res) => {
    try {
      const { salon_id, service_id, barber_id, appointment_date, appointment_time, phone } = req.body;

      if (!salon_id || !service_id || !barber_id || !appointment_date || !appointment_time || !phone) {
        return res.status(400).json({ error: 'All fields including phone required' });
      }

      const cleanPhone = normalizePhone(phone);
      const now = Date.now();
      const attempt = publicBookingAttempts.get(cleanPhone) || { count: 0, blockedUntil: 0 };
      if (attempt.blockedUntil > now) {
        const remaining = Math.ceil((attempt.blockedUntil - now) / 1000);
        return res.status(429).json({ error: `Too many requests. Try again in ${remaining} seconds` });
      }
      attempt.count++;
      if (attempt.count >= 3) {
        attempt.blockedUntil = now + 60 * 60 * 1000;
        attempt.count = 0;
      }
      publicBookingAttempts.set(cleanPhone, attempt);

      const today = new Date().toISOString().split('T')[0];
      if (appointment_date < today) {
        return res.status(400).json({ error: 'Appointment date cannot be in the past' });
      }

      const services: any = await query(
        'SELECT id, duration FROM services WHERE id = ? AND salon_id = ? AND is_active = TRUE',
        [service_id, salon_id]
      );
      if (services.length === 0) {
        return res.status(400).json({ error: 'Service not found in this salon' });
      }

      const barbers: any = await query(
        "SELECT id FROM barbers WHERE id = ? AND salon_id = ? AND status = 'active'",
        [barber_id, salon_id]
      );
      if (barbers.length === 0) {
        return res.status(400).json({ error: 'Barber not found in this salon' });
      }

      // Ensure customer exists
      await query(
        'INSERT IGNORE INTO customers (phone, name) VALUES (?, ?)',
        [phone, phone]
      );

      const serviceDuration = services[0].duration;
      const endTime = calculateEndTime(appointment_time, serviceDuration);
      const token = generateBookingToken();

      const sessionId = `salon-${salon_id}`;
      if (!isSessionConnected(sessionId)) {
        await createPendingBooking({
          salon_id,
          customer_phone: phone,
          customer_name: phone,
          service_id,
          barber_id,
          appointment_date,
          appointment_time,
        });
        return res.status(202).json({
          success: true,
          queued: true,
          message: 'WhatsApp disconnected. Booking queued — we will confirm once connection is restored.'
        });
      }

      const result = await createAppointment({
        salon_id,
        barber_id,
        customer_phone: phone,
        service_id,
        appointment_date,
        appointment_time,
        end_time: endTime,
        token,
      });

      if (!result.success) {
        return res.status(409).json({ error: result.error || 'Booking failed' });
      }

      const created: any = await query(
        `SELECT a.*, s.name as service_name, b.name as barber_name, sl.name as salon_name
         FROM appointments a
         JOIN services s ON a.service_id = s.id
         JOIN barbers b ON a.barber_id = b.id
         JOIN salons sl ON a.salon_id = sl.id
         WHERE a.id = ?`,
        [result.id]
      );

      res.status(201).json(created[0]);
    } catch (e: any) {
      console.error('[Booking Route Error]', e?.message || e);
      res.status(500).json({ error: 'Booking failed' });
    }
  });

  function calculateEndTime(startTime: string, durationMinutes: number): string {
    const [h, m] = startTime.split(':').map(Number);
    const totalMinutes = h * 60 + m + durationMinutes;
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  }
}
