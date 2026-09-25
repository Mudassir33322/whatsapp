import mysql from 'mysql2/promise';
import Database from 'better-sqlite3';
import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { 
  Salon, Country, City, Area, SalonMedia, SalonReview, SalonPortfolio, 
  Customer, Staff, Service, Booking 
} from './types';
import type { QueryResult, WorkingHourInput, SeatInput, SalaryInput, ShopSettingsInput } from './src/types/api';
import { timeToMinutes } from './utils';

dotenv.config();

export function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

function verifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  if (stored.length === 64 && /^[0-9a-f]+$/.test(stored)) {
    return hashPin(pin) === stored;
  }
  return pin === stored;
}

type DbPool = mysql.Pool | InstanceType<typeof Database>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let pool: DbPool | any;

// ─── Pluggable cache (in-memory by default, Redis optional) ─────
// Delegates to cache.ts so the implementation can be swapped without
// touching the rest of the app. Local (no REDIS_URL) behavior is identical.
import { cachedQuery, setCache, clearCache } from './cache';
export { cachedQuery, setCache, clearCache };

if (process.env.USE_SQLITE === 'true') {
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'autozap_dev.sqlite');
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -20000');
  pool = db;
  
  // Create all tables
  db.exec(`CREATE TABLE IF NOT EXISTS countries (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone_code TEXT, is_active INTEGER DEFAULT 1)`);
  db.exec(`CREATE TABLE IF NOT EXISTS cities (id INTEGER PRIMARY KEY AUTOINCREMENT, country_id INTEGER NOT NULL, name TEXT NOT NULL, is_active INTEGER DEFAULT 1, FOREIGN KEY (country_id) REFERENCES countries(id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS areas (id INTEGER PRIMARY KEY AUTOINCREMENT, city_id INTEGER NOT NULL, name TEXT NOT NULL, is_active INTEGER DEFAULT 1, FOREIGN KEY (city_id) REFERENCES cities(id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS salons (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, owner_name TEXT, phone TEXT UNIQUE, email TEXT UNIQUE, password TEXT, owner_phone TEXT, country_id INTEGER, city_id INTEGER, area_id INTEGER, address TEXT, cover_image_url TEXT, logo_url TEXT, description TEXT, status TEXT DEFAULT 'pending', rating REAL DEFAULT 0, review_count INTEGER DEFAULT 0, assigned_admin_id INTEGER, latitude REAL, longitude REAL, commission_rate REAL DEFAULT 0, commission_type TEXT DEFAULT 'percentage', created_at TEXT DEFAULT (datetime('now')))`);
  db.exec(`CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT DEFAULT 'admin', is_active INTEGER DEFAULT 1, twofa_enabled INTEGER DEFAULT 0, twofa_code TEXT, last_login TEXT, created_at TEXT, updated_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS barbers (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, name TEXT NOT NULL, phone TEXT, email TEXT, bio TEXT, experience INTEGER DEFAULT 0, specialization TEXT, profile_image TEXT, rating REAL DEFAULT 0, review_count INTEGER DEFAULT 0, status TEXT DEFAULT 'active', pin_code TEXT, created_at TEXT, FOREIGN KEY (salon_id) REFERENCES salons(id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, name TEXT NOT NULL, description TEXT, price REAL NOT NULL, duration INTEGER NOT NULL, category TEXT, is_active INTEGER DEFAULT 1, created_at TEXT, FOREIGN KEY (salon_id) REFERENCES salons(id))`);
   db.exec(`CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, barber_id INTEGER, customer_phone TEXT NOT NULL, customer_name TEXT, service_id INTEGER NOT NULL, appointment_date TEXT NOT NULL, appointment_time TEXT NOT NULL, end_time TEXT, status TEXT DEFAULT 'pending', token TEXT UNIQUE, notes TEXT, created_at TEXT, recurring_booking_id INTEGER, FOREIGN KEY (salon_id) REFERENCES salons(id), FOREIGN KEY (barber_id) REFERENCES barbers(id), FOREIGN KEY (service_id) REFERENCES services(id), UNIQUE(barber_id, appointment_date, appointment_time))`);
  db.exec(`CREATE TABLE IF NOT EXISTS customers (phone TEXT PRIMARY KEY, name TEXT, email TEXT, password_hash TEXT, has_set_password INTEGER DEFAULT 0, global_points INTEGER DEFAULT 0, loyalty_points INTEGER DEFAULT 0, total_visits INTEGER DEFAULT 0, referral_code TEXT, status TEXT DEFAULT 'New', last_status TEXT DEFAULT 'New', last_active TEXT, created_at TEXT, updated_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, phone TEXT NOT NULL, push_name TEXT, text TEXT NOT NULL, from_me INTEGER DEFAULT 0, timestamp TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, name TEXT NOT NULL, price REAL NOT NULL, stock INTEGER DEFAULT 0, min_stock INTEGER DEFAULT 0, unit TEXT DEFAULT 'piece', is_active INTEGER DEFAULT 1, created_at TEXT, FOREIGN KEY (salon_id) REFERENCES salons(id))`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_products_name_salon ON products(salon_id, name)`);
  db.exec(`CREATE TABLE IF NOT EXISTS barber_schedule (id INTEGER PRIMARY KEY AUTOINCREMENT, barber_id INTEGER NOT NULL, day_of_week INTEGER NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, slot_duration INTEGER DEFAULT 30, is_available INTEGER DEFAULT 1, break_start TEXT, break_end TEXT, FOREIGN KEY (barber_id) REFERENCES barbers(id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS recurring_bookings (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, barber_id INTEGER NOT NULL, customer_phone TEXT NOT NULL, customer_name TEXT, service_id INTEGER NOT NULL, appointment_time TEXT NOT NULL, end_time TEXT NOT NULL, frequency TEXT, day_of_week INTEGER, day_of_month INTEGER, status TEXT DEFAULT 'active', last_generated TEXT, next_date TEXT, created_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS notification_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER, notification_type TEXT, customer_phone TEXT, message_sent TEXT, sent_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS staff (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, name TEXT NOT NULL, role TEXT, salary_type TEXT, base_salary REAL, commission_rate REAL, phone TEXT, created_at TEXT, FOREIGN KEY (salon_id) REFERENCES salons(id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS seats (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, name TEXT NOT NULL, status TEXT DEFAULT 'Available', assigned_staff_id INTEGER, created_at TEXT, FOREIGN KEY (salon_id) REFERENCES salons(id))`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_seats_name_salon ON seats(salon_id, name)`);
  db.exec(`CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, description TEXT NOT NULL, amount REAL NOT NULL, category TEXT, date TEXT NOT NULL, created_at TEXT, FOREIGN KEY (salon_id) REFERENCES salons(id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS revenue (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, amount REAL NOT NULL, date TEXT NOT NULL, created_at TEXT, FOREIGN KEY (salon_id) REFERENCES salons(id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, barber_id INTEGER, customer_phone TEXT NOT NULL, rating INTEGER NOT NULL, comment TEXT, created_at TEXT, updated_at TEXT, FOREIGN KEY (salon_id) REFERENCES salons(id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS offers (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, title TEXT NOT NULL, description TEXT, discount_percent REAL, valid_from TEXT, valid_until TEXT, is_active INTEGER DEFAULT 1, created_at TEXT, FOREIGN KEY (salon_id) REFERENCES salons(id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, admin_id INTEGER, admin_email TEXT, action TEXT NOT NULL, entity_type TEXT, entity_id TEXT, details TEXT, ip_address TEXT, created_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS bot_states (phone TEXT PRIMARY KEY, state_data TEXT, updated_at TEXT DEFAULT (datetime('now')))`);
  db.exec(`CREATE TABLE IF NOT EXISTS sent_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, appointment_id INTEGER, type TEXT, customer_phone TEXT, sent_at TEXT DEFAULT (datetime('now')))`);
  db.exec(`CREATE TABLE IF NOT EXISTS notification_preferences (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, reminder_30min INTEGER DEFAULT 1, queue_update INTEGER DEFAULT 1, review_request INTEGER DEFAULT 1, re_engagement INTEGER DEFAULT 1, FOREIGN KEY (salon_id) REFERENCES salons(id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS whatsapp_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT UNIQUE, name TEXT, status TEXT DEFAULT 'disconnected', created_at TEXT DEFAULT (datetime('now')))`);
  db.exec(`CREATE TABLE IF NOT EXISTS barber_attendance (id INTEGER PRIMARY KEY AUTOINCREMENT, barber_id INTEGER NOT NULL, salon_id INTEGER NOT NULL, date TEXT, clock_in TEXT, clock_out TEXT, status TEXT DEFAULT 'clocked_in', pin_code TEXT, source TEXT, FOREIGN KEY (barber_id) REFERENCES barbers(id), FOREIGN KEY (salon_id) REFERENCES salons(id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS customer_tags (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_phone TEXT NOT NULL, tag TEXT NOT NULL, UNIQUE(customer_phone, tag))`);
  db.exec(`CREATE TABLE IF NOT EXISTS payouts (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, barber_id INTEGER, amount REAL, method TEXT DEFAULT 'bank', account_details TEXT, status TEXT DEFAULT 'pending', period_start TEXT, period_end TEXT, processed_at TEXT, processed_by INTEGER, admin_notes TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (salon_id) REFERENCES salons(id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS disputes (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, customer_phone TEXT, appointment_id INTEGER, title TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'open', resolution TEXT, resolved_by INTEGER, resolved_at TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (salon_id) REFERENCES salons(id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS broadcast_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, title TEXT, message TEXT, target TEXT, status TEXT DEFAULT 'draft', scheduled_at TEXT, sent_at TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (salon_id) REFERENCES salons(id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS automations (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, trigger_type TEXT NOT NULL, action_type TEXT NOT NULL, action_config TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE)`);
  db.exec(`CREATE TABLE IF NOT EXISTS salon_media (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, media_url TEXT NOT NULL, media_type TEXT DEFAULT 'image', title TEXT, description TEXT, display_order INTEGER DEFAULT 0, is_cover INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (salon_id) REFERENCES salons(id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS salon_portfolio (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, service_id INTEGER, title TEXT NOT NULL, description TEXT, media_url TEXT NOT NULL, media_type TEXT DEFAULT 'image', created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (salon_id) REFERENCES salons(id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS working_hours (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, day INTEGER NOT NULL, start_time TEXT, end_time TEXT, is_open INTEGER DEFAULT 1, FOREIGN KEY (salon_id) REFERENCES salons(id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS shop_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL UNIQUE, company_name TEXT, currency TEXT DEFAULT 'Rs.', language TEXT DEFAULT 'Urdu/English', address TEXT, map_url TEXT, FOREIGN KEY (salon_id) REFERENCES salons(id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS salaries (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, staff_id INTEGER NOT NULL, amount REAL NOT NULL, type TEXT, status TEXT DEFAULT 'Paid', date TEXT DEFAULT (datetime('now')), created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (salon_id) REFERENCES salons(id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS platform_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, setting_key TEXT UNIQUE NOT NULL, setting_value TEXT NOT NULL, setting_type TEXT DEFAULT 'string', description TEXT, updated_by INTEGER, updated_at TEXT DEFAULT (datetime('now')))`);
  db.exec(`CREATE TABLE IF NOT EXISTS coupons (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, type TEXT NOT NULL, value REAL NOT NULL, min_amount REAL DEFAULT 0, max_uses INTEGER DEFAULT 0, used_count INTEGER DEFAULT 0, valid_from TEXT, valid_until TEXT, is_active INTEGER DEFAULT 1, created_by INTEGER, created_at TEXT DEFAULT (datetime('now')))`);
  db.exec(`CREATE TABLE IF NOT EXISTS templates (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, type TEXT NOT NULL, subject TEXT, body TEXT NOT NULL, variables TEXT, is_active INTEGER DEFAULT 1, updated_by INTEGER, created_at TEXT DEFAULT (datetime('now')))`);
db.exec(`CREATE TABLE IF NOT EXISTS barber_services (id INTEGER PRIMARY KEY AUTOINCREMENT, barber_id INTEGER NOT NULL, service_id INTEGER NOT NULL, price REAL, FOREIGN KEY (barber_id) REFERENCES barbers(id), FOREIGN KEY (service_id) REFERENCES services(id), UNIQUE(barber_id, service_id))`);
   db.exec(`CREATE TABLE IF NOT EXISTS bot_paused (phone TEXT PRIMARY KEY, paused INTEGER DEFAULT 0)`);
   db.exec(`CREATE TABLE IF NOT EXISTS customer_preferences (phone TEXT NOT NULL, pref_key TEXT NOT NULL, pref_value TEXT, PRIMARY KEY (phone, pref_key))`);
   db.exec(`CREATE TABLE IF NOT EXISTS barber_portfolio (id INTEGER PRIMARY KEY AUTOINCREMENT, barber_id INTEGER NOT NULL, media_url TEXT NOT NULL, media_type TEXT, title TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (barber_id) REFERENCES barbers(id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS customer_otps (phone TEXT PRIMARY KEY, code TEXT NOT NULL, expires_at TEXT NOT NULL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS admin_2fa_tokens (temp_token TEXT PRIMARY KEY, admin_id INTEGER NOT NULL, email TEXT NOT NULL, expires_at TEXT NOT NULL)`);
   db.exec(`CREATE TABLE IF NOT EXISTS day_offs (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, date TEXT NOT NULL, reason TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (salon_id) REFERENCES salons(id))`);
   db.exec(`CREATE TABLE IF NOT EXISTS pending_bookings (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, customer_phone TEXT NOT NULL, customer_name TEXT, service_id INTEGER NOT NULL, barber_id INTEGER, appointment_date TEXT NOT NULL, appointment_time TEXT NOT NULL, status TEXT DEFAULT 'pending', created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (salon_id) REFERENCES salons(id))`);

// SQLite migrations
   try { db.exec('ALTER TABLE barber_schedule ADD COLUMN break_start TEXT'); } catch (e) { console.warn('[SQLite] break_start column may already exist'); }
   try { db.exec('ALTER TABLE barber_schedule ADD COLUMN break_end TEXT'); } catch (e) { console.warn('[SQLite] break_end column may already exist'); }
   try { db.exec('ALTER TABLE customers ADD COLUMN email TEXT'); } catch (e) { console.warn('[SQLite] email column may already exist'); }
   try { db.exec('ALTER TABLE customers ADD COLUMN password_hash TEXT'); } catch (e) { console.warn('[SQLite] password_hash column may already exist'); }
   try { db.exec('ALTER TABLE customers ADD COLUMN has_set_password INTEGER DEFAULT 0'); } catch (e) { console.warn('[SQLite] has_set_password column may already exist'); }
   try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_appointment_slot ON appointments(barber_id, appointment_date, appointment_time)'); } catch (e) { console.warn('[SQLite] index may already exist'); }
    try { db.exec("ALTER TABLE salons ADD COLUMN owner_phone TEXT"); } catch (e) { /* column already exists */ }
    try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_salon_phone ON salons(phone)"); } catch (e) { console.warn('[SQLite] phone index may already exist'); }
    try { db.exec('ALTER TABLE appointments ADD COLUMN recurring_booking_id INTEGER'); } catch (e) { console.warn('[SQLite] recurring_booking_id column may already exist'); }
// Performance indexes for notification queries
try { db.exec('CREATE INDEX IF NOT EXISTS idx_appointments_date_status ON appointments(appointment_date, status)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_appointments_customer_phone ON appointments(customer_phone)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_appointments_salon_id ON appointments(salon_id)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_messages_session_phone ON messages(session_id, phone)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_products_salon_stock ON products(salon_id, stock, min_stock)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_offers_active ON offers(salon_id, is_active, valid_from, valid_until)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_sent_notifications_lookup ON sent_notifications(appointment_id, type, customer_phone)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_barber_schedule_lookup ON barber_schedule(barber_id, day_of_week)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_day_offs_lookup ON day_offs(salon_id, date, is_active)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_working_hours_lookup ON working_hours(salon_id, day)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_appointments_token ON appointments(token)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_appointments_barber_date ON appointments(barber_id, appointment_date, status)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_messages_phone_timestamp ON messages(phone, timestamp)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_salon ON reviews(salon_id, created_at)'); } catch (e) {}
// Additional performance indexes for enterprise scale
try { db.exec('CREATE INDEX IF NOT EXISTS idx_barbers_salon_status ON barbers(salon_id, status)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_services_salon_active ON services(salon_id, is_active)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_revenue_salon_date ON revenue(salon_id, date)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_expenses_salon_date ON expenses(salon_id, date)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_staff_salon ON staff(salon_id)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_seats_salon ON seats(salon_id)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_barber_attendance_salon_date ON barber_attendance(salon_id, date)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_barber_attendance_barber_date ON barber_attendance(barber_id, date)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_notification_logs_salon ON notification_logs(salon_id, sent_at)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_payouts_salon_status ON payouts(salon_id, status)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_disputes_salon_status ON disputes(salon_id, status)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_broadcast_salon_status ON broadcast_notifications(salon_id, status)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_salon_media_salon ON salon_media(salon_id, media_type)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_salon_portfolio_salon ON salon_portfolio(salon_id)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_bot_states_updated ON bot_states(updated_at)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_salons_status ON salons(status)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_salons_country_city ON salons(country_id, city_id)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_id, created_at)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_salaries_salon ON salaries(salon_id, date)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_recurring_bookings_salon ON recurring_bookings(salon_id, status)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_coupons_code_active ON coupons(code, is_active)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_templates_type_active ON templates(type, is_active)'); } catch (e) {}
// Seed default admin
    const adminExists = db.prepare('SELECT id FROM admins WHERE email = ?').get('admin@autozap.com');
    if (!adminExists) {
      const hash = bcrypt.hashSync('admin123', 10);
      db.prepare('INSERT INTO admins (name, email, password, role, is_active) VALUES (?, ?, ?, ?, 1)').run(['Super Admin', 'admin@autozap.com', hash, 'super_admin']);
      console.log('[SQLite] Default admin created: admin@autozap.com / admin123');
    }

// Seed default salon
   const salonExists = db.prepare('SELECT id FROM salons WHERE email = ?').get('primecuts@salon.com');
   if (!salonExists) {
      const hash = bcrypt.hashSync('admin123', 10);
      const r = db.prepare(`INSERT INTO salons (name, owner_name, phone, email, password, address, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`).run([
        'Prime Cuts', 'John Owner', '3001112222', 'primecuts@salon.com', hash,
        '123 Main Street, Downtown', 'Premium salon offering haircuts, styling, and grooming services.'
      ]);
      console.log('[SQLite] Default salon created: primecuts@salon.com / admin123');
     const salonId = Number(r.lastInsertRowid);

    // Seed country
    const countryExists = db.prepare('SELECT id FROM countries WHERE name = ?').get('Pakistan');
    if (!countryExists) {
      db.prepare('INSERT INTO countries (name, phone_code, is_active) VALUES (?, ?, 1)').run(['Pakistan', '+92']);
      console.log('[SQLite] Country seeded: Pakistan');
    }
    
    // Seed multiple countries
    const countries = [
      { name: 'United States', code: '+1' },
      { name: 'United Kingdom', code: '+44' },
      { name: 'Canada', code: '+1' },
      { name: 'Australia', code: '+61' },
      { name: 'Germany', code: '+49' },
      { name: 'France', code: '+33' },
      { name: 'India', code: '+91' },
      { name: 'UAE', code: '+971' },
      { name: 'Saudi Arabia', code: '+966' },
      { name: 'Turkey', code: '+90' }
    ];
    for (const c of countries) {
      const exists = db.prepare('SELECT id FROM countries WHERE name = ?').get(c.name);
      if (!exists) {
        db.prepare('INSERT INTO countries (name, phone_code, is_active) VALUES (?, ?, 1)').run([c.name, c.code]);
        console.log(`[SQLite] Country seeded: ${c.name}`);
      }
    }

    // Seed city
    const cityExists = db.prepare('SELECT id FROM cities WHERE name = ? AND country_id = ?').get('Karachi', 1);
    if (!cityExists) {
      db.prepare('INSERT INTO cities (country_id, name, is_active) VALUES (?, ?, 1)').run([1, 'Karachi']);
      console.log('[SQLite] City seeded: Karachi');
    }
    
    // Seed multiple cities for Pakistan (country_id 1)
    const pakistanCities = ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Peshawar', 'Quetta', 'Faisalabad', 'Multan', 'Hyderabad', 'Sialkot'];
    for (const city of pakistanCities) {
      const exists = db.prepare('SELECT id FROM cities WHERE name = ? AND country_id = ?').get(city, 1);
      if (!exists) {
        db.prepare('INSERT INTO cities (country_id, name, is_active) VALUES (?, ?, 1)').run([1, city]);
        console.log(`[SQLite] City seeded: ${city}`);
      }
    }
    
    // Seed areas for Karachi (city_id 1)
    const karachiAreas = ['Clifton', 'DHA', 'Gulshan-e-Iqbal', 'North Nazimabad', 'South Nazimabad', 'PECHS', 'Defence', 'Malir', 'Korangi', 'Landhi'];
    for (const area of karachiAreas) {
      const exists = db.prepare('SELECT id FROM areas WHERE name = ? AND city_id = ?').get(area, 1);
      if (!exists) {
        db.prepare('INSERT INTO areas (city_id, name, is_active) VALUES (?, ?, 1)').run([1, area]);
        console.log(`[SQLite] Area seeded: ${area}`);
      }
    }

    // Link salon to country/city/area
    const salonRow = db.prepare('SELECT country_id, city_id, area_id FROM salons WHERE id = ?').get(salonId) as any;
    if (!salonRow?.country_id && !salonRow?.city_id && !salonRow?.area_id) {
      db.prepare('UPDATE salons SET country_id = 1, city_id = 1, area_id = 1 WHERE id = ?').run([salonId]);
    }

    // Seed barbers
    const barberCount = (db.prepare('SELECT COUNT(*) as c FROM barbers WHERE salon_id = ?').get(salonId) as any).c;
    if (barberCount === 0) {
      db.prepare(`INSERT INTO barbers (salon_id, name, phone, experience, specialization, rating, review_count, status, bio)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`).run([salonId, 'Usman', '3001112233', 8, 'Haircuts & Styling', 4.8, 120, 'Expert barber with 8 years of experience']);
      db.prepare(`INSERT INTO barbers (salon_id, name, phone, experience, specialization, rating, review_count, status, bio)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`).run([salonId, 'Ahmed', '3001112244', 5, 'Beard & Grooming', 4.6, 85, 'Specialist in beard styling and grooming']);
      db.prepare(`INSERT INTO barbers (salon_id, name, phone, experience, specialization, rating, review_count, status, bio)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`).run([salonId, 'Bilal', '3001112255', 6, 'Color & Highlights', 4.7, 98, 'Color and highlights specialist']);
      db.prepare(`INSERT INTO barbers (salon_id, name, phone, experience, specialization, rating, review_count, status, bio)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`).run([salonId, 'Farhan', '3001112266', 10, 'Traditional & Party Cuts', 4.9, 200, 'Master barber for traditional cuts and party styling']);
      console.log('[SQLite] 4 barbers seeded for Prime Cuts');
    }

    // Seed services
    const serviceCount = (db.prepare('SELECT COUNT(*) as c FROM services WHERE salon_id = ?').get(salonId) as any).c;
    if (serviceCount === 0) {
      db.prepare('INSERT INTO services (salon_id, name, description, price, duration, category) VALUES (?, ?, ?, ?, ?, ?)').run([salonId, 'Haircut', 'Classic haircut with scissors and clippers', 500, 30, 'Hair']);
      db.prepare('INSERT INTO services (salon_id, name, description, price, duration, category) VALUES (?, ?, ?, ?, ?, ?)').run([salonId, 'Beard Trim', 'Professional beard shaping and trimming', 300, 20, 'Beard']);
      db.prepare('INSERT INTO services (salon_id, name, description, price, duration, category) VALUES (?, ?, ?, ?, ?, ?)').run([salonId, 'Haircut + Beard', 'Full haircut and beard grooming combo', 700, 45, 'Combo']);
      db.prepare('INSERT INTO services (salon_id, name, description, price, duration, category) VALUES (?, ?, ?, ?, ?, ?)').run([salonId, 'Hair Color', 'Professional hair coloring with premium products', 1500, 60, 'Color']);
      db.prepare('INSERT INTO services (salon_id, name, description, price, duration, category) VALUES (?, ?, ?, ?, ?, ?)').run([salonId, 'Party Styling', 'Special party and event hairstyling', 1000, 45, 'Styling']);
      console.log('[SQLite] 5 services seeded for Prime Cuts');
    }

    // Seed barber schedules (Mon-Sat, 9 AM - 8 PM)
    const scheduleCount = (db.prepare('SELECT COUNT(*) as c FROM barber_schedule WHERE barber_id = ?').get(1) as any).c;
    if (scheduleCount === 0) {
      const barberIds = [1, 2, 3, 4];
      for (const bid of barberIds) {
        for (let day = 1; day <= 6; day++) {
          db.prepare('INSERT INTO barber_schedule (barber_id, day_of_week, start_time, end_time, slot_duration, is_available) VALUES (?, ?, ?, ?, 30, 1)').run([bid, day, '09:00', '20:00']);
        }
      }
      console.log('[SQLite] Barber schedules seeded (Mon-Sat 9AM-8PM)');
    }

    // Seed offers
    const offerCount = (db.prepare('SELECT COUNT(*) as c FROM offers WHERE salon_id = ?').get(salonId) as any).c;
    if (offerCount === 0) {
      const today = new Date().toISOString().split('T')[0];
      const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      db.prepare('INSERT INTO offers (salon_id, title, description, discount_percent, valid_from, valid_until, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)').run([salonId, 'First Visit Discount', '20% off on your first haircut', 20, today, future]);
      db.prepare('INSERT INTO offers (salon_id, title, description, discount_percent, valid_from, valid_until, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)').run([salonId, 'Combo Offer', 'Haircut + Beard at Rs. 700 only (save Rs. 100)', 12.5, today, future]);
      console.log('[SQLite] 2 offers seeded for Prime Cuts');
    }
  }
} else {
  const poolSize = parseInt(process.env.DB_POOL_SIZE || '25', 10);
  const dbPort = parseInt(process.env.DB_PORT || '3306', 10);
  const dbSsl = process.env.DB_SSL === 'true' ? {} : undefined;
  const p = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: dbPort,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'autozap_platform',
    waitForConnections: true,
    connectionLimit: poolSize,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    ssl: dbSsl,
    timezone: '+05:00',
    charset: 'utf8mb4'
  });
  pool = p;
  (pool as any).on('error', (err: any) => {
    console.error('[DB] Pool error:', err.message);
  });
    // MySQL migrations
  (async () => {
    try {
      await (pool as mysql.Pool).execute('CREATE TABLE IF NOT EXISTS day_offs (id INT AUTO_INCREMENT PRIMARY KEY, salon_id INT NOT NULL, date DATE NOT NULL, reason VARCHAR(255), is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE)');
      await (pool as mysql.Pool).execute('CREATE TABLE IF NOT EXISTS pending_bookings (id INT AUTO_INCREMENT PRIMARY KEY, salon_id INT NOT NULL, customer_phone VARCHAR(20) NOT NULL, customer_name VARCHAR(100), service_id INT NOT NULL, barber_id INT, appointment_date DATE NOT NULL, appointment_time TIME NOT NULL, status VARCHAR(20) DEFAULT \'pending\', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE)');
      await (pool as mysql.Pool).execute('CREATE TABLE IF NOT EXISTS customer_otps (phone VARCHAR(20) PRIMARY KEY, code VARCHAR(10) NOT NULL, expires_at DATETIME NOT NULL)');
      await (pool as mysql.Pool).execute('CREATE TABLE IF NOT EXISTS bot_paused (phone VARCHAR(20) PRIMARY KEY, paused BOOLEAN DEFAULT 0)');
      await (pool as mysql.Pool).execute('CREATE TABLE IF NOT EXISTS customer_preferences (phone VARCHAR(20) NOT NULL, pref_key VARCHAR(50) NOT NULL, pref_value TEXT, PRIMARY KEY (phone, pref_key))');
      await (pool as mysql.Pool).execute('CREATE TABLE IF NOT EXISTS barber_portfolio (id INT AUTO_INCREMENT PRIMARY KEY, barber_id INT NOT NULL, media_url TEXT NOT NULL, media_type VARCHAR(50), title VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (barber_id) REFERENCES barbers(id))');
      await (pool as mysql.Pool).execute('CREATE TABLE IF NOT EXISTS admin_2fa_tokens (temp_token VARCHAR(100) PRIMARY KEY, admin_id INT NOT NULL, email VARCHAR(100) NOT NULL, expires_at DATETIME NOT NULL)');
      await (pool as mysql.Pool).execute('ALTER TABLE barber_schedule ADD COLUMN IF NOT EXISTS break_start TIME NULL');
      await (pool as mysql.Pool).execute('ALTER TABLE barber_schedule ADD COLUMN IF NOT EXISTS break_end TIME NULL');
      await (pool as mysql.Pool).execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_status VARCHAR(50) DEFAULT 'New' AFTER status");
      await (pool as mysql.Pool).execute("ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'disconnected' AFTER name");
      await (pool as mysql.Pool).execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_appointment_slot ON appointments(barber_id, appointment_date, appointment_time)").catch(() => {});
      await (pool as mysql.Pool).execute("ALTER TABLE barbers ADD COLUMN IF NOT EXISTS pin_code VARCHAR(10) DEFAULT NULL AFTER profile_image").catch(() => {});
      await (pool as mysql.Pool).execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS email VARCHAR(100) DEFAULT NULL AFTER name").catch(() => {});
      await (pool as mysql.Pool).execute("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurring_booking_id INT NULL AFTER created_at").catch(() => {});
      try {
        const [rows] = await (pool as mysql.Pool).execute("SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'error_logs'", [process.env.DB_NAME || 'autozap_platform']);
        if ((rows as any)[0].cnt === 0) {
          await (pool as mysql.Pool).execute('CREATE TABLE IF NOT EXISTS error_logs (id INT AUTO_INCREMENT PRIMARY KEY, source VARCHAR(100), message TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        }
      } catch (_) {}
      // Performance indexes for enterprise scale
      const mysqlIndexes = [
        'CREATE INDEX IF NOT EXISTS idx_barbers_salon_status ON barbers(salon_id, status)',
        'CREATE INDEX IF NOT EXISTS idx_services_salon_active ON services(salon_id, is_active)',
        'CREATE INDEX IF NOT EXISTS idx_revenue_salon_date ON revenue(salon_id, date)',
        'CREATE INDEX IF NOT EXISTS idx_expenses_salon_date ON expenses(salon_id, date)',
        'CREATE INDEX IF NOT EXISTS idx_staff_salon ON staff(salon_id)',
        'CREATE INDEX IF NOT EXISTS idx_seats_salon ON seats(salon_id)',
        'CREATE INDEX IF NOT EXISTS idx_barber_attendance_salon_date ON barber_attendance(salon_id, date)',
        'CREATE INDEX IF NOT EXISTS idx_barber_attendance_barber_date ON barber_attendance(barber_id, date)',
        'CREATE INDEX IF NOT EXISTS idx_notification_logs_salon ON notification_logs(salon_id, sent_at)',
        'CREATE INDEX IF NOT EXISTS idx_payouts_salon_status ON payouts(salon_id, status)',
        'CREATE INDEX IF NOT EXISTS idx_disputes_salon_status ON disputes(salon_id, status)',
        'CREATE INDEX IF NOT EXISTS idx_broadcast_salon_status ON broadcast_notifications(salon_id, status)',
        'CREATE INDEX IF NOT EXISTS idx_salon_media_salon ON salon_media(salon_id, media_type)',
        'CREATE INDEX IF NOT EXISTS idx_salon_portfolio_salon ON salon_portfolio(salon_id)',
        'CREATE INDEX IF NOT EXISTS idx_bot_states_updated ON bot_states(updated_at)',
        'CREATE INDEX IF NOT EXISTS idx_salons_status ON salons(status)',
        'CREATE INDEX IF NOT EXISTS idx_salons_country_city ON salons(country_id, city_id)',
        'CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status)',
        'CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_id, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_salaries_salon ON salaries(salon_id, date)',
        'CREATE INDEX IF NOT EXISTS idx_recurring_bookings_salon ON recurring_bookings(salon_id, status)',
        'CREATE INDEX IF NOT EXISTS idx_coupons_code_active ON coupons(code, is_active)',
        'CREATE INDEX IF NOT EXISTS idx_templates_type_active ON templates(type, is_active)',
      ];
      for (const idx of mysqlIndexes) {
        await (pool as mysql.Pool).execute(idx).catch(() => {});
      }
    } catch (e) {
      console.error('[DB MySQL Migration Error]', e);
    }
  })();
}

// --- DB Core Functions ---

export async function query(sql: string, params: any[] = []): Promise<any> {
  // SQLite path
  if (process.env.USE_SQLITE === 'true') {
sql = sql.replace(/\bNOW\(\)/gi, "datetime('now')");
     sql = sql.replace(/\bCURDATE\(\)/gi, "date('now')");
     sql = sql.replace(/ON DUPLICATE KEY UPDATE/gi, "ON CONFLICT DO UPDATE SET");
     sql = sql.replace(/VALUES\(([a-zA-Z_][a-zA-Z0-9_]*)\)/gi, "excluded.$1");
     sql = sql.replace(/\bHOUR\(([a-zA-Z_][a-zA-Z0-9_]*)\)/gi, "CAST(strftime('%H', $1) AS INTEGER)");
     sql = sql.replace(/\bINSERT IGNORE\b/gi, "INSERT OR IGNORE");
    const stmt = (pool as any).prepare(sql);
    if (/^\s*SELECT/i.test(sql)) {
      return stmt.all(params);
    } else {
      try {
        const result = stmt.run(params);
        return { insertId: Number(result.lastInsertRowid), affectedRows: result.changes };
      } catch (err: any) {
        if (err.code === 'SQLITE_CONSTRAINT') err.code = 'ER_DUP_ENTRY';
        throw err;
      }
    }
  }
  
  // MySQL path
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const [rows] = await (pool as mysql.Pool).execute(sql, params);
      return rows;
    } catch (err: any) {
      const isLastAttempt = attempt === maxRetries;

      if (err.code === 'ER_NO_SUCH_TABLE') {
        const tableName = err.sqlMessage.match(/Table '.+\.(\w+)' doesn't exist/)?.[1];
        await autoCreateTable(tableName);
        if (tableName) {
          const [rows] = await (pool as mysql.Pool).execute(sql, params);
          return rows;
        }
        console.warn(`[DB] Table not found (returning empty): ${err.sqlMessage}`);
        return [];
      }

      if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ETIMEDOUT') {
        console.warn(`[DB] Connection error (attempt ${attempt}/${maxRetries}): ${err.code}`);
        await new Promise(r => setTimeout(r, 1000 * attempt));
        if (!isLastAttempt) continue;
      }

      if (err.code === 'ER_LOCK_DEADLOCK' || err.code === 'ER_LOCK_WAIT_TIMEOUT') {
        console.warn(`[DB] Deadlock detected (attempt ${attempt}/${maxRetries}), retrying...`);
        await new Promise(r => setTimeout(r, 500 * attempt));
        if (!isLastAttempt) continue;
      }

      if (err.code === 'ER_DUP_ENTRY') {
        console.warn(`[DB] Duplicate entry: ${err.sqlMessage}`);
        throw err;
      }

      console.error(`[DB Query Error] ${err.code || 'UNKNOWN'}: ${err.message}`);
      throw err;
    }
  }
}

export async function beginTransaction(): Promise<void> {
  if (process.env.USE_SQLITE === 'true') {
    (pool as any).exec('BEGIN TRANSACTION');
  } else {
    await (pool as mysql.Pool).query('START TRANSACTION');
  }
}

export async function commit(): Promise<void> {
  if (process.env.USE_SQLITE === 'true') {
    (pool as any).exec('COMMIT');
  } else {
    await (pool as mysql.Pool).query('COMMIT');
  }
}

export async function rollback(): Promise<void> {
  if (process.env.USE_SQLITE === 'true') {
    (pool as any).exec('ROLLBACK');
  } else {
    await (pool as mysql.Pool).query('ROLLBACK');
  }
}

export async function paginatedQuery(
  baseSql: string,
  countSql: string,
  params: unknown[],
  page: number = 1,
  limit: number = 20
): Promise<{ data: Record<string, unknown>[]; total: number; page: number; limit: number; totalPages: number }> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, Math.min(100, limit));
  const offset = (safePage - 1) * safeLimit;
  const [totalRows, data] = await Promise.all([
    query(countSql, params),
    query(`${baseSql} LIMIT ? OFFSET ?`, [...params, safeLimit, offset]),
  ]);
  const total = Array.isArray(totalRows) ? (totalRows[0]?.total ?? totalRows[0]?.count ?? 0) : 0;
  return { data, total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) };
}

async function autoCreateTable(tableName: string | undefined) {
  if (!tableName) return;
  const isSQLite = process.env.USE_SQLITE === 'true';
  switch (tableName) {
    case 'bot_states':
      if (isSQLite) {
        await pool.prepare('CREATE TABLE IF NOT EXISTS bot_states (phone TEXT PRIMARY KEY, state_data TEXT, updated_at TEXT DEFAULT (datetime(\'now\')))').run();
      } else {
        await pool.execute(
          'CREATE TABLE IF NOT EXISTS bot_states (phone VARCHAR(20) PRIMARY KEY, state_data TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)'
        );
      }
      break;
    case 'automations':
      if (isSQLite) {
        await pool.prepare(`CREATE TABLE IF NOT EXISTS automations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          salon_id INTEGER NOT NULL,
          trigger_type TEXT NOT NULL,
          action_type TEXT NOT NULL,
          action_config TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
        )`).run();
      } else {
        await pool.execute(
          `CREATE TABLE IF NOT EXISTS automations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            salon_id INT NOT NULL,
            trigger_type VARCHAR(50) NOT NULL,
            action_type VARCHAR(50) NOT NULL,
            action_config TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
          )`
        );
      }
      break;
   case 'admins':
      if (isSQLite) {
        await pool.prepare(`CREATE TABLE IF NOT EXISTS admins (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          role TEXT DEFAULT 'admin',
          is_active INTEGER DEFAULT 1,
          twofa_enabled INTEGER DEFAULT 0,
          twofa_code TEXT,
          last_login TEXT,
          created_at TEXT,
          updated_at TEXT
        )`).run();
        seedDefaultAdmin();
      } else {
        await pool.execute(
          `CREATE TABLE IF NOT EXISTS admins (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            role ENUM('super_admin', 'admin', 'support', 'viewer') DEFAULT 'admin',
            is_active BOOLEAN DEFAULT TRUE,
            last_login TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )`
        );
        // Fix missing columns if table already existed from older schema
        try { await pool.execute("ALTER TABLE admins ADD COLUMN IF NOT EXISTS last_login TIMESTAMP NULL AFTER is_active"); } catch (_) {}
        try { await pool.execute("ALTER TABLE admins ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER last_login"); } catch (_) {}
        try { await pool.execute("ALTER TABLE admins MODIFY COLUMN role ENUM('super_admin','admin','support','viewer') DEFAULT 'admin'"); } catch (_) {}
        await seedDefaultAdmin();
      }
      break;
    case 'messages':
      await pool.execute(
        `CREATE TABLE IF NOT EXISTS messages (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          session_id VARCHAR(100) DEFAULT NULL,
          phone VARCHAR(20) NOT NULL,
          push_name VARCHAR(100) DEFAULT NULL,
          text TEXT NOT NULL,
          from_me BOOLEAN DEFAULT FALSE,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_session_phone (session_id, phone),
          INDEX idx_phone (phone),
          INDEX idx_timestamp (timestamp)
        )`
      );
      break;
    case 'expenses':
      await pool.execute(
        `CREATE TABLE IF NOT EXISTS expenses (
          id INT AUTO_INCREMENT PRIMARY KEY,
          salon_id INT NOT NULL,
          description TEXT NOT NULL,
          amount DECIMAL(12,2) NOT NULL,
          category VARCHAR(100) DEFAULT NULL,
          date DATE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
        )`
      );
      break;
    case 'revenue':
      await pool.execute(
        `CREATE TABLE IF NOT EXISTS revenue (
          id INT AUTO_INCREMENT PRIMARY KEY,
          salon_id INT NOT NULL,
          booking_id INT DEFAULT NULL,
          amount DECIMAL(12,2) NOT NULL,
          date DATE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
        )`
      );
      break;
    case 'products':
      await pool.execute(
        `CREATE TABLE IF NOT EXISTS products (
          id INT AUTO_INCREMENT PRIMARY KEY,
          salon_id INT NOT NULL,
          name VARCHAR(200) NOT NULL,
          price DECIMAL(12,2) NOT NULL,
          stock INT DEFAULT 0,
          min_stock INT DEFAULT 0,
          unit VARCHAR(20) DEFAULT 'piece',
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
        )`
      );
      break;
    case 'recurring_bookings':
      await pool.execute(
        `CREATE TABLE IF NOT EXISTS recurring_bookings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          salon_id INT NOT NULL,
          barber_id INT NOT NULL,
          customer_phone VARCHAR(20) NOT NULL,
          customer_name VARCHAR(100) DEFAULT NULL,
          service_id INT NOT NULL,
          appointment_time TIME NOT NULL,
          end_time TIME NOT NULL,
          frequency ENUM('weekly','monthly') NOT NULL,
          day_of_week TINYINT DEFAULT NULL,
          day_of_month TINYINT DEFAULT NULL,
          status ENUM('active','paused','cancelled') DEFAULT 'active',
          last_generated DATE DEFAULT NULL,
          next_date DATE DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_phone (customer_phone),
          INDEX idx_status (status),
          FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE,
          FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE,
          FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
        )`
      );
      break;
    case 'countries':
      await pool.execute(
        `CREATE TABLE IF NOT EXISTS countries (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          phone_code VARCHAR(20),
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );
      break;
    case 'cities':
      await pool.execute(
        `CREATE TABLE IF NOT EXISTS cities (
          id INT AUTO_INCREMENT PRIMARY KEY,
          country_id INT NOT NULL,
          name VARCHAR(100) NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE
        )`
      );
      break;
    case 'areas':
      await pool.execute(
        `CREATE TABLE IF NOT EXISTS areas (
          id INT AUTO_INCREMENT PRIMARY KEY,
          city_id INT NOT NULL,
          name VARCHAR(100) NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE
        )`
      );
      break;

    case 'customers':
      await pool.execute(
          `CREATE TABLE IF NOT EXISTS customers (
            phone VARCHAR(20) PRIMARY KEY,
            name VARCHAR(100),
            email VARCHAR(100),
            global_points INT DEFAULT 0,
            loyalty_points INT DEFAULT 0,
            total_visits INT DEFAULT 0,
            referral_code VARCHAR(10) UNIQUE,
            status VARCHAR(50) DEFAULT 'New',
            last_status VARCHAR(50) DEFAULT 'idle',
            last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )`
      );
      break;

    case 'notification_logs':
      await pool.execute(
        `CREATE TABLE IF NOT EXISTS notification_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          salon_id INT,
          notification_type ENUM('visit', 'booking', 'reminder'),
          customer_phone VARCHAR(20),
          message_sent TEXT,
          sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );
      break;
    case 'payouts':
      await pool.execute(
        `CREATE TABLE IF NOT EXISTS payouts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          salon_id INT NOT NULL,
          barber_id INT DEFAULT NULL,
          amount DECIMAL(12,2) NOT NULL,
          method VARCHAR(50) DEFAULT 'bank',
          account_details TEXT,
          status VARCHAR(50) DEFAULT 'pending',
          period_start DATE,
          period_end DATE,
          processed_at TIMESTAMP NULL,
          processed_by INT,
          admin_notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
        )`
      );
      break;
    case 'customer_otps':
      if (isSQLite) {
        await pool.prepare(`CREATE TABLE IF NOT EXISTS customer_otps (phone TEXT PRIMARY KEY, code TEXT NOT NULL, expires_at TEXT NOT NULL)`).run();
      } else {
        await pool.execute(
          `CREATE TABLE IF NOT EXISTS customer_otps (phone VARCHAR(20) PRIMARY KEY, code VARCHAR(10) NOT NULL, expires_at DATETIME NOT NULL)`
        );
      }
      break;
    case 'shop_settings':
      if (isSQLite) {
        await pool.prepare(`CREATE TABLE IF NOT EXISTS shop_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL UNIQUE, company_name TEXT, currency TEXT DEFAULT 'Rs.', language TEXT DEFAULT 'Urdu/English', address TEXT, map_url TEXT, FOREIGN KEY (salon_id) REFERENCES salons(id))`).run();
      } else {
        await pool.execute(
          `CREATE TABLE IF NOT EXISTS shop_settings (id INT AUTO_INCREMENT PRIMARY KEY, salon_id INT NOT NULL UNIQUE, company_name VARCHAR(200), currency VARCHAR(20) DEFAULT 'Rs.', language VARCHAR(50) DEFAULT 'Urdu/English', address TEXT, map_url TEXT, FOREIGN KEY (salon_id) REFERENCES salons(id))`
        );
      }
      break;
    case 'salon_media':
      if (isSQLite) {
        await pool.prepare(`CREATE TABLE IF NOT EXISTS salon_media (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, media_url TEXT NOT NULL, media_type TEXT DEFAULT 'image', title TEXT, description TEXT, display_order INTEGER DEFAULT 0, is_cover INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (salon_id) REFERENCES salons(id))`).run();
      } else {
        await pool.execute(
          `CREATE TABLE IF NOT EXISTS salon_media (id INT AUTO_INCREMENT PRIMARY KEY, salon_id INT NOT NULL, media_url TEXT NOT NULL, media_type VARCHAR(50) DEFAULT 'image', title VARCHAR(255), description TEXT, display_order INT DEFAULT 0, is_cover BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (salon_id) REFERENCES salons(id))`
        );
      }
      break;
    case 'barber_portfolio':
      if (isSQLite) {
        await pool.prepare(`CREATE TABLE IF NOT EXISTS barber_portfolio (id INTEGER PRIMARY KEY AUTOINCREMENT, barber_id INTEGER NOT NULL, media_url TEXT NOT NULL, media_type TEXT, title TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (barber_id) REFERENCES barbers(id))`).run();
      } else {
        await pool.execute(
          `CREATE TABLE IF NOT EXISTS barber_portfolio (id INT AUTO_INCREMENT PRIMARY KEY, barber_id INT NOT NULL, media_url TEXT NOT NULL, media_type VARCHAR(50), title VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (barber_id) REFERENCES barbers(id))`
        );
      }
      break;
    case 'notification_preferences':
      if (isSQLite) {
        await pool.prepare(`CREATE TABLE IF NOT EXISTS notification_preferences (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, reminder_30min INTEGER DEFAULT 1, queue_update INTEGER DEFAULT 1, review_request INTEGER DEFAULT 1, re_engagement INTEGER DEFAULT 1, FOREIGN KEY (salon_id) REFERENCES salons(id))`).run();
      } else {
        await pool.execute(
          `CREATE TABLE IF NOT EXISTS notification_preferences (id INT AUTO_INCREMENT PRIMARY KEY, salon_id INT NOT NULL, reminder_30min BOOLEAN DEFAULT TRUE, queue_update BOOLEAN DEFAULT TRUE, review_request BOOLEAN DEFAULT TRUE, re_engagement BOOLEAN DEFAULT TRUE, FOREIGN KEY (salon_id) REFERENCES salons(id))`
        );
      }
      break;
    default:
      console.warn(`[DB] Unknown table '${tableName}', creation not implemented`);
  }
}

// ─── MySQL Location Seeding ──────────────────────────────────────────
async function seedLocationsMySQL() {
  try {
    // Check if countries exist
    const [count] = await pool.execute('SELECT COUNT(*) as cnt FROM countries') as any[];
    if ((count[0]?.cnt || 0) === 0) {
      const countries = [
        ['Pakistan', '+92'],
        ['United States', '+1'],
        ['United Kingdom', '+44'],
        ['Canada', '+1'],
        ['Australia', '+61'],
        ['Germany', '+49'],
        ['France', '+33'],
        ['India', '+91'],
        ['UAE', '+971'],
        ['Saudi Arabia', '+966']
      ];
      for (const [name, code] of countries) {
        await pool.execute('INSERT INTO countries (name, phone_code, is_active) VALUES (?, ?, 1)', [name, code]);
      }
      console.log('[MySQL] 10 countries seeded');
      
      // Cities for Pakistan (country_id 1)
      const pakistanCities = ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Peshawar', 'Quetta', 'Faisalabad', 'Multan', 'Hyderabad', 'Sialkot'];
      for (const city of pakistanCities) {
        await pool.execute('INSERT INTO cities (country_id, name, is_active) VALUES (?, ?, 1)', [1, city]);
      }
      console.log('[MySQL] 10 cities seeded for Pakistan');
      
      // Areas for Karachi (city_id 1)
      const karachiAreas = ['Clifton', 'DHA', 'Gulshan-e-Iqbal', 'North Nazimabad', 'South Nazimabad', 'PECHS', 'Defence', 'Malir', 'Korangi', 'Landhi'];
      for (const area of karachiAreas) {
        await pool.execute('INSERT INTO areas (city_id, name, is_active) VALUES (?, ?, 1)', [1, area]);
      }
      console.log('[MySQL] 10 areas seeded for Karachi');
    }
  } catch (e: any) {
    console.warn('[DB] Could not seed locations:', e.message);
  }
}

export async function updateCustomerStatus(phone: string, status: string): Promise<void> {
  if (process.env.USE_SQLITE === 'true') {
    await query("UPDATE customers SET last_status = ?, last_active = datetime('now') WHERE phone = ?", [status, phone]);
  } else {
    await query('UPDATE customers SET last_status = ?, last_active = NOW() WHERE phone = ?', [status, phone]);
  }
}

async function seedDefaultAdmin() {
   try {
     const [existing] = await pool.execute('SELECT id FROM admins WHERE email = ?', ['admin@autozap.com']) as any[];
     if (existing.length === 0) {
       const bcryptMod = await import('bcryptjs');
        const hash = await bcryptMod.hash('admin123', 10);
        await pool.execute(
          'INSERT INTO admins (name, email, password, role, is_active) VALUES (?, ?, ?, ?, ?)',
          ['Super Admin', 'admin@autozap.com', hash, 'super_admin', 1]
        );
        console.log('[DB] Default admin created: admin@autozap.com / admin123');
     }
   } catch (e: any) {
    console.warn('[DB] Could not seed admin:', e.message);
  }
}

// --- Salon Functions ---

export async function getAllSalons(): Promise<Salon[]> {
  const rows = await query('SELECT id, name, owner_name, phone, email, owner_phone, country_id, city_id, area_id, address, cover_image_url, logo_url, description, status, rating, review_count, assigned_admin_id, latitude, longitude, commission_rate, commission_type, created_at FROM salons');
  return rows as Salon[];
}

export async function getSalonById(id: number): Promise<Salon | null> {
  const key = `salon_${id}`;
  const cached = cachedQuery(key);
  if (cached) return cached.data as Salon;
  const rows = await query('SELECT * FROM salons WHERE id = ?', [id]);
  const salons = rows as Salon[];
  if (salons.length > 0) setCache(key, salons[0]);
  return salons.length > 0 ? salons[0] : null;
}

export async function getAllLocations(): Promise<{city: string, area: string}[]> {
  const rows = await query(`
    SELECT DISTINCT c.name as city, a.name as area
    FROM salons s
    LEFT JOIN cities c ON s.city_id = c.id
    LEFT JOIN areas a ON s.area_id = a.id
    WHERE s.status = 'active'
  `);
  return rows as {city: string, area: string}[];
}

// --- Customer Functions ---

export async function getAllCustomers(): Promise<Customer[]> {
  const rows = await query('SELECT phone, name, email, global_points, loyalty_points, total_visits, referral_code, status, last_status, last_active, created_at FROM customers');
  return rows as Customer[];
}

// --- Staff Functions ---

export async function getAllStaff(salonId?: number): Promise<Staff[]> {
  const sql = salonId ? 'SELECT id, salon_id, name, role, salary_type, base_salary, commission_rate, phone FROM staff WHERE salon_id = ?' : 'SELECT id, salon_id, name, role, salary_type, base_salary, commission_rate, phone FROM staff';
  const rows = await query(sql, salonId ? [salonId] : []);
  return rows as Staff[];
}

export async function upsertStaff(staff: Partial<Staff> & { salon_id: number, name: string }): Promise<any> {
  if (staff.id) {
    return await query(
      'UPDATE staff SET name = ?, role = ?, salary_type = ?, base_salary = ?, commission_rate = ? WHERE id = ? AND salon_id = ?',
      [staff.name, staff.role, staff.salary_type, staff.base_salary, staff.commission_rate, staff.id, staff.salon_id]
    );
  } else {
    return await query(
      'INSERT INTO staff (salon_id, name, role, salary_type, base_salary, commission_rate) VALUES (?, ?, ?, ?, ?, ?)',
      [staff.salon_id, staff.name, staff.role, staff.salary_type, staff.base_salary, staff.commission_rate]
    );
  }
}

export async function deleteStaff(id: number): Promise<void> {
  await query('DELETE FROM staff WHERE id = ?', [id]);
}

// --- Service Functions ---

export async function getAllServices(salonId?: number): Promise<Service[]> {
  const sql = salonId ? 'SELECT id, salon_id, name, description, price, duration, category, is_active FROM services WHERE salon_id = ?' : 'SELECT id, salon_id, name, description, price, duration, category, is_active FROM services';
  const rows = await query(sql, salonId ? [salonId] : []);
  return rows as Service[];
}

export async function getServicesBySalon(salonId: number): Promise<Service[]> {
  const key = `services_${salonId}`;
  const cached = cachedQuery(key);
  if (cached) return cached.data as Service[];
  const rows = await getAllServices(salonId);
  setCache(key, rows);
  return rows as Service[];
}

export async function upsertService(service: Partial<Service> & { salon_id: number, name: string }): Promise<any> {
  let result;
  if (service.id) {
    result = await query(
      'UPDATE services SET name = ?, price = ?, duration = ? WHERE id = ? AND salon_id = ?',
      [service.name, service.price, service.duration, service.id, service.salon_id]
    );
  } else {
    result = await query(
      'INSERT INTO services (salon_id, name, price, duration) VALUES (?, ?, ?, ?)',
      [service.salon_id, service.name, service.price, service.duration]
    );
  }
  if (service.salon_id) clearCache(`services_${service.salon_id}`);
  return result;
}

export async function deleteService(id: number, salonId?: number): Promise<void> {
  await query('DELETE FROM services WHERE id = ?', [id]);
  if (salonId) clearCache(`services_${salonId}`);
}

// --- Booking Functions (maps to appointments table) ---

export async function createBooking(booking: {
  salon_id: number;
  barber_id?: number;
  staff_id?: number;
  customer_phone: string;
  service_id: number;
  appointment_date: string;
  appointment_time: string;
  token: string;
  notes?: string;
}): Promise<number> {
  const res: any = await query(
    `INSERT INTO appointments (salon_id, barber_id, customer_phone, service_id, appointment_date, appointment_time, end_time, token, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [booking.salon_id, booking.barber_id || booking.staff_id || null, booking.customer_phone, booking.service_id,
     booking.appointment_date, booking.appointment_time, booking.appointment_time, booking.token, booking.notes || null]
  );
  return res.insertId;
}

export async function getAllBookings(salonId?: number): Promise<any[]> {
  const sql = salonId 
    ? `SELECT a.*, s.name as service_name, b.name as barber_name, sl.name as salon_name
       FROM appointments a
       JOIN services s ON a.service_id = s.id
       LEFT JOIN barbers b ON a.barber_id = b.id
       JOIN salons sl ON a.salon_id = sl.id
       WHERE a.salon_id = ? ORDER BY a.created_at DESC`
    : `SELECT a.*, s.name as service_name, b.name as barber_name, sl.name as salon_name
       FROM appointments a
       JOIN services s ON a.service_id = s.id
       JOIN salons sl ON a.salon_id = sl.id
       LEFT JOIN barbers b ON a.barber_id = b.id
       ORDER BY a.created_at DESC`;
  const rows = await query(sql, salonId ? [salonId] : []);
  return rows as any[];
}

export async function getBookingsByPhone(phone: string): Promise<any[]> {
    const sql = `
        SELECT a.*, s.name as service_name, sl.name as salon_name, b.name as barber_name
        FROM appointments a
        JOIN services s ON a.service_id = s.id
        JOIN salons sl ON a.salon_id = sl.id
        LEFT JOIN barbers b ON a.barber_id = b.id
        WHERE a.customer_phone = ?
        ORDER BY a.appointment_date DESC, a.appointment_time DESC
    `;
    const rows = await query(sql, [phone]);
    return rows as any[];
}

export async function updateBookingStatus(id: number, status: string): Promise<void> {
  await query('UPDATE appointments SET status = ? WHERE id = ?', [status, id]);
}

export async function deleteBooking(id: number): Promise<void> {
  await query('DELETE FROM appointments WHERE id = ?', [id]);
}

// --- Bot State Functions ---

async function ensureBotStatesTable(): Promise<void> {
  try {
    if (process.env.USE_SQLITE === 'true') {
      (pool as any).exec('CREATE TABLE IF NOT EXISTS bot_states (phone TEXT PRIMARY KEY, state_data TEXT, updated_at TEXT DEFAULT (datetime(\'now\')))');
    }
  } catch (_) {}
}

export async function getBotState(phone: string): Promise<any> {
    try {
      const rows: any = await query('SELECT state_data, updated_at FROM bot_states WHERE phone = ?', [phone]);
      if (rows.length === 0) return { step: 'IDLE' };
      const state = JSON.parse(rows[0].state_data);
      state.updatedAt = rows[0].updated_at ? new Date(rows[0].updated_at).getTime() : Date.now();
      return state;
    } catch (e: any) {
      if (e?.message?.includes('no such table')) {
        await ensureBotStatesTable();
        return { step: 'IDLE' };
      }
      throw e;
    }
}

export async function saveBotState(phone: string, state: any): Promise<void> {
    const stateData = JSON.stringify(state);
    try {
      await query(
          `INSERT INTO bot_states (phone, state_data) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_data = ?, updated_at = NOW()`,
          [phone, stateData, stateData]
      );
    } catch (e: any) {
      if (e?.message?.includes('no such table')) {
        await ensureBotStatesTable();
        await query(
            `INSERT INTO bot_states (phone, state_data) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_data = ?, updated_at = NOW()`,
            [phone, stateData, stateData]
        );
      } else {
        throw e;
      }
    }
}

// --- Finance Functions ---

export async function addRevenue(revenue: { salon_id: number, booking_id?: number, amount: number, date: string }): Promise<any> {
  return await query(
    'INSERT INTO revenue (salon_id, booking_id, amount, date) VALUES (?, ?, ?, ?)',
    [revenue.salon_id, revenue.booking_id, revenue.amount, revenue.date]
  );
}

export async function addExpense(expense: { salon_id: number, description: string, amount: number, category: string, date: string }): Promise<any> {
  return await query(
    'INSERT INTO expenses (salon_id, description, amount, category, date) VALUES (?, ?, ?, ?, ?)',
    [expense.salon_id, expense.description, expense.amount, expense.category, expense.date]
  );
}

// --- Settings & Working Hours ---

export async function getWorkingHours(salonId: number): Promise<any[]> {
  const rows = await query('SELECT * FROM working_hours WHERE salon_id = ?', [salonId]);
  return rows as any[];
}

export async function updateWorkingHours(salonId: number, hours: WorkingHourInput[]): Promise<void> {
  await query('DELETE FROM working_hours WHERE salon_id = ?', [salonId]);
  for (const h of hours) {
    await query(
      'INSERT INTO working_hours (salon_id, day, start_time, end_time, is_open) VALUES (?, ?, ?, ?, ?)',
      [salonId, h.day, h.start, h.end, h.isOpen ? 1 : 0]
    );
  }
}

// --- Seat Functions ---

export async function getAllSeats(salonId: number): Promise<Record<string, unknown>[]> {
  return await query('SELECT * FROM seats WHERE salon_id = ?', [salonId]) as any[];
}

export async function upsertSeat(seat: SeatInput): Promise<any> {
  if (seat.id) {
    return await query(
      'UPDATE seats SET name = ?, status = ?, assigned_staff_id = ? WHERE id = ? AND salon_id = ?',
      [seat.name, seat.status, seat.assigned_staff_id || null, seat.id, seat.salon_id]
    );
  } else {
    return await query(
      'INSERT INTO seats (salon_id, name, status, assigned_staff_id) VALUES (?, ?, ?, ?)',
      [seat.salon_id, seat.name, seat.status || 'Available', seat.assigned_staff_id || null]
    );
  }
}

export async function deleteSeat(id: number): Promise<void> {
  await query('DELETE FROM seats WHERE id = ?', [id]);
}

// --- Salary Functions ---

export async function getAllSalaries(salonId: number): Promise<any[]> {
  const sql = `
    SELECT s.*, st.name as staffName 
    FROM salaries s 
    JOIN staff st ON s.staff_id = st.id 
    WHERE s.salon_id = ? ORDER BY s.date DESC`;
  return await query(sql, [salonId]) as any[];
}

export async function addSalary(salary: any): Promise<any> {
  return await query(
    'INSERT INTO salaries (salon_id, staff_id, amount, type, status) VALUES (?, ?, ?, ?, ?)',
    [salary.salon_id, salary.staff_id, salary.amount, salary.type, salary.status || 'Paid']
  );
}

export async function deleteSalary(id: number): Promise<void> {
  await query('DELETE FROM salaries WHERE id = ?', [id]);
}

// --- Settings Functions ---

export async function getShopSettings(salonId: number): Promise<any> {
  const rows: any = await query('SELECT * FROM shop_settings WHERE salon_id = ?', [salonId]);
  if (rows.length > 0) return rows[0];
  
  // Default settings if none exist
  return {
    salon_id: salonId,
    company_name: 'AutoZap Salon',
    currency: 'Rs.',
    language: 'Urdu/English',
    address: '',
    map_url: ''
  };
}

export async function updateShopSettings(settings: any): Promise<void> {
  await query(
    'INSERT INTO shop_settings (salon_id, company_name, currency, language, address, map_url) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE company_name = ?, currency = ?, language = ?, address = ?, map_url = ?',
    [
      settings.salon_id, settings.company_name, settings.currency, settings.language, settings.address, settings.map_url,
      settings.company_name, settings.currency, settings.language, settings.address, settings.map_url
    ]
  );
}

// --- Location Functions ---

export async function getAllCountries(): Promise<Country[]> {
  const cached = cachedQuery('countries');
  if (cached) return cached.data as Country[];
  const rows = await query('SELECT * FROM countries WHERE is_active = TRUE ORDER BY name');
  setCache('countries', rows);
  return rows as Country[];
}

export async function getCitiesByCountry(countryId: number): Promise<City[]> {
  const key = `cities_${countryId}`;
  const cached = cachedQuery(key);
  if (cached) return cached.data as City[];
  const rows = await query('SELECT * FROM cities WHERE country_id = ? AND is_active = TRUE ORDER BY name', [countryId]);
  setCache(key, rows);
  return rows as City[];
}

export async function getAreasByCity(cityId: number): Promise<Area[]> {
  const key = `areas_${cityId}`;
  const cached = cachedQuery(key);
  if (cached) return cached.data as Area[];
  const rows = await query('SELECT * FROM areas WHERE city_id = ? AND is_active = TRUE ORDER BY name', [cityId]);
  setCache(key, rows);
  return rows as Area[];
}

// --- Location CRUD Functions ---

export async function updateCountry(id: number, data: { name?: string; phone_code?: string; is_active?: boolean }): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
  if (data.phone_code !== undefined) { sets.push('phone_code = ?'); params.push(data.phone_code); }
  if (data.is_active !== undefined) { sets.push('is_active = ?'); params.push(data.is_active ? 1 : 0); }
  if (sets.length === 0) return;
  params.push(id);
  await query(`UPDATE countries SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function deleteCountry(id: number): Promise<void> {
  await query('DELETE FROM areas WHERE city_id IN (SELECT id FROM cities WHERE country_id = ?)', [id]);
  await query('DELETE FROM cities WHERE country_id = ?', [id]);
  await query('DELETE FROM countries WHERE id = ?', [id]);
}

export async function updateCity(id: number, data: { name?: string; country_id?: number; is_active?: boolean }): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
  if (data.country_id !== undefined) { sets.push('country_id = ?'); params.push(data.country_id); }
  if (data.is_active !== undefined) { sets.push('is_active = ?'); params.push(data.is_active ? 1 : 0); }
  if (sets.length === 0) return;
  params.push(id);
  await query(`UPDATE cities SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function deleteCity(id: number): Promise<void> {
  await query('DELETE FROM areas WHERE city_id = ?', [id]);
  await query('DELETE FROM cities WHERE id = ?', [id]);
}

export async function updateArea(id: number, data: { name?: string; city_id?: number; is_active?: boolean }): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
  if (data.city_id !== undefined) { sets.push('city_id = ?'); params.push(data.city_id); }
  if (data.is_active !== undefined) { sets.push('is_active = ?'); params.push(data.is_active ? 1 : 0); }
  if (sets.length === 0) return;
  params.push(id);
  await query(`UPDATE areas SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function deleteArea(id: number): Promise<void> {
  await query('DELETE FROM areas WHERE id = ?', [id]);
}

// --- Salon CRUD ---

export async function createSalon(data: {
  name: string; owner_name?: string; phone?: string; email?: string; password?: string; owner_phone?: string;
  country_id?: number; city_id?: number; area_id?: number; address?: string;
  cover_image_url?: string; logo_url?: string; description?: string;
  latitude?: number; longitude?: number; commission_rate?: number; commission_type?: string;
}): Promise<number> {
  const nowExpr = process.env.USE_SQLITE === 'true' ? "datetime('now')" : 'NOW()';
  const res: any = await query(
    `INSERT INTO salons (name, owner_name, phone, email, password, owner_phone, country_id, city_id, area_id, address, cover_image_url, logo_url, description, latitude, longitude, commission_rate, commission_type, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ${nowExpr})`,
    [data.name, data.owner_name || null, data.phone || null, data.email || null, data.password || null, data.owner_phone || null,
     data.country_id || null, data.city_id || null, data.area_id || null, data.address || null,
     data.cover_image_url || null, data.logo_url || null, data.description || null,
     data.latitude || null, data.longitude || null, data.commission_rate || 0, data.commission_type || 'percentage']
  );
  clearCache(`salon_${res.insertId}`);
  clearCache('salons_loc');
  return res.insertId;
}

export async function updateSalon(id: number, data: {
  name?: string; owner_name?: string; phone?: string; email?: string; owner_phone?: string;
  country_id?: number; city_id?: number; area_id?: number; address?: string;
  cover_image_url?: string; logo_url?: string; description?: string; status?: string;
  latitude?: number; longitude?: number; commission_rate?: number; commission_type?: string;
}): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
  if (data.owner_name !== undefined) { sets.push('owner_name = ?'); params.push(data.owner_name); }
  if (data.phone !== undefined) { sets.push('phone = ?'); params.push(data.phone); }
  if (data.email !== undefined) { sets.push('email = ?'); params.push(data.email); }
  if (data.owner_phone !== undefined) { sets.push('owner_phone = ?'); params.push(data.owner_phone); }
  if (data.country_id !== undefined) { sets.push('country_id = ?'); params.push(data.country_id); }
  if (data.city_id !== undefined) { sets.push('city_id = ?'); params.push(data.city_id); }
  if (data.area_id !== undefined) { sets.push('area_id = ?'); params.push(data.area_id); }
  if (data.address !== undefined) { sets.push('address = ?'); params.push(data.address); }
  if (data.cover_image_url !== undefined) { sets.push('cover_image_url = ?'); params.push(data.cover_image_url); }
  if (data.logo_url !== undefined) { sets.push('logo_url = ?'); params.push(data.logo_url); }
  if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description); }
  if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
  if (data.latitude !== undefined) { sets.push('latitude = ?'); params.push(data.latitude); }
  if (data.longitude !== undefined) { sets.push('longitude = ?'); params.push(data.longitude); }
  if (data.commission_rate !== undefined) { sets.push('commission_rate = ?'); params.push(data.commission_rate); }
  if (data.commission_type !== undefined) { sets.push('commission_type = ?'); params.push(data.commission_type); }
  if (sets.length === 0) return;
  params.push(id);
  await query(`UPDATE salons SET ${sets.join(', ')} WHERE id = ?`, params);
  clearCache(`salon_${id}`);
  clearCache('salons_loc');
}

export async function deleteSalon(id: number): Promise<void> {
  clearCache(`salon_${id}`);
  clearCache('salons_loc');
  await query('DELETE FROM working_hours WHERE salon_id = ?', [id]);
  await query('DELETE FROM shop_settings WHERE salon_id = ?', [id]);
  await query('DELETE FROM barber_attendance WHERE salon_id = ?', [id]);
  await query('DELETE FROM barber_schedule WHERE barber_id IN (SELECT id FROM barbers WHERE salon_id = ?)', [id]);
  await query('DELETE FROM barber_services WHERE barber_id IN (SELECT id FROM barbers WHERE salon_id = ?)', [id]);
  await query('DELETE FROM barber_portfolio WHERE barber_id IN (SELECT id FROM barbers WHERE salon_id = ?)', [id]);
  await query('DELETE FROM appointments WHERE salon_id = ?', [id]);
  await query('DELETE FROM barbers WHERE salon_id = ?', [id]);
  await query('DELETE FROM services WHERE salon_id = ?', [id]);
  await query('DELETE FROM offers WHERE salon_id = ?', [id]);
  await query('DELETE FROM reviews WHERE salon_id = ?', [id]);
  await query('DELETE FROM salon_media WHERE salon_id = ?', [id]);
  await query('DELETE FROM salon_portfolio WHERE salon_id = ?', [id]);
  await query('DELETE FROM products WHERE salon_id = ?', [id]);
  await query('DELETE FROM staff WHERE salon_id = ?', [id]);
  await query('DELETE FROM seats WHERE salon_id = ?', [id]);
  await query('DELETE FROM salaries WHERE salon_id = ?', [id]);
  await query('DELETE FROM expenses WHERE salon_id = ?', [id]);
  await query('DELETE FROM revenue WHERE salon_id = ?', [id]);
  await query('DELETE FROM notification_preferences WHERE salon_id = ?', [id]);
  await query('DELETE FROM payouts WHERE salon_id = ?', [id]);
  await query('DELETE FROM disputes WHERE salon_id = ?', [id]);
  await query('DELETE FROM broadcast_notifications WHERE salon_id = ?', [id]);
  await query('DELETE FROM automations WHERE salon_id = ?', [id]);
  await query('DELETE FROM recurring_bookings WHERE salon_id = ?', [id]);
  await query('DELETE FROM day_offs WHERE salon_id = ?', [id]);
  await query('DELETE FROM salons WHERE id = ?', [id]);
}

// --- Enhanced Salon Functions ---

export async function getSalonsByLocation(countryId?: number, cityId?: number, areaId?: number): Promise<Salon[]> {
  const key = `salons_loc_${countryId ?? 0}_${cityId ?? 0}_${areaId ?? 0}`;
  const cached = cachedQuery(key);
  if (cached) return cached.data as Salon[];
  let sql = "SELECT s.id, s.name, s.owner_name, s.phone, s.owner_phone, s.email, s.country_id, s.city_id, s.area_id, s.address, s.cover_image_url, s.logo_url, s.description, s.status, s.rating, s.review_count, s.assigned_admin_id, s.latitude, s.longitude, s.commission_rate, s.commission_type, s.created_at FROM salons s WHERE s.status = 'active'";
  const params: any[] = [];
  
  if (areaId !== undefined && areaId !== null) {
    sql += ' AND s.area_id = ?';
    params.push(areaId);
  } else if (cityId !== undefined && cityId !== null) {
    sql += ' AND s.city_id = ?';
    params.push(cityId);
  } else if (countryId !== undefined && countryId !== null) {
    sql += ' AND s.country_id = ?';
    params.push(countryId);
  }
  
  sql += ' ORDER BY s.name ASC';
  
  const rows = await query(sql, params);
  setCache(key, rows);
  return rows as Salon[];
}

export async function getSalonByIdWithDetails(id: number): Promise<{
  salon: Salon | null;
  media: SalonMedia[];
  reviews: SalonReview[];
  portfolio: SalonPortfolio[];
} | null> {
  // Get salon basic info
  const salonRows = await query(`
    SELECT s.*, 
           c.name as city_name, 
           a.name as area_name, 
           co.name as country_name
    FROM salons s
    LEFT JOIN cities c ON s.city_id = c.id
    LEFT JOIN areas a ON s.area_id = a.id
    LEFT JOIN countries co ON s.country_id = co.id
    WHERE s.id = ? AND s.status = 'active'
  `, [id]);
  
  if (salonRows.length === 0) {
    return null;
  }
  
  const salon = salonRows[0] as Salon;
  
  // Get salon media
  const mediaRows = await query(
    'SELECT * FROM salon_media WHERE salon_id = ? ORDER BY display_order DESC, is_cover DESC, created_at ASC',
    [id]
  );
  const media = mediaRows as SalonMedia[];
  
  // Get recent reviews
  const reviewRows = await query(`
    SELECT r.*, c.name as customer_name 
    FROM reviews r 
    LEFT JOIN customers c ON r.customer_phone = c.phone 
    WHERE r.salon_id = ? 
    ORDER BY r.created_at DESC 
    LIMIT 10
  `, [id]);
  const reviews = reviewRows as SalonReview[];
  
  // Get portfolio
  const portfolioRows = await query(`
    SELECT p.*, s.name as service_name 
    FROM salon_portfolio p 
    LEFT JOIN services s ON p.service_id = s.id 
    WHERE p.salon_id = ?
    ORDER BY p.created_at DESC
  `, [id]);
  const portfolio = portfolioRows as SalonPortfolio[];
  
  return {
    salon,
    media,
    reviews,
    portfolio
  };
}

// --- Salon Media Functions ---

export async function upsertSalonMedia(media: Partial<SalonMedia> & { salon_id: number, media_url: string }): Promise<any> {
  if (media.id) {
    return await query(
      'UPDATE salon_media SET media_url = ?, media_type = ?, title = ?, description = ?, display_order = ?, is_cover = ? WHERE id = ? AND salon_id = ?',
      [media.media_url, media.media_type, media.title, media.description, media.display_order, media.is_cover ? 1 : 0, media.id, media.salon_id]
    );
  } else {
    return await query(
      'INSERT INTO salon_media (salon_id, media_url, media_type, title, description, display_order, is_cover) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [media.salon_id, media.media_url, media.media_type, media.title, media.description, media.display_order, media.is_cover ? 1 : 0]
    );
  }
}

export async function deleteSalonMedia(id: number): Promise<void> {
  await query('DELETE FROM salon_media WHERE id = ?', [id]);
}

export async function setSalonCoverImage(salonId: number, mediaId: number): Promise<void> {
  // First, unset any existing cover image
  await query('UPDATE salon_media SET is_cover = 0 WHERE salon_id = ?', [salonId]);
  // Then set the new cover image
  await query('UPDATE salon_media SET is_cover = 1 WHERE id = ? AND salon_id = ?', [mediaId, salonId]);
}

// --- Salon Review Functions ---

export async function createSalonReview(data: { salon_id: number; customer_phone: string; rating: number; comment?: string }): Promise<any> {
  return await query(
    'INSERT INTO reviews (salon_id, customer_phone, rating, comment) VALUES (?, ?, ?, ?)',
    [data.salon_id, data.customer_phone, data.rating, data.comment || null]
  );
}

// --- Salon Portfolio Functions ---

export async function upsertSalonPortfolio(portfolio: Partial<SalonPortfolio> & { salon_id: number, title: string, media_url: string }): Promise<any> {
  if (portfolio.id) {
    return await query(
      'UPDATE salon_portfolio SET service_id = ?, title = ?, description = ?, media_url = ?, media_type = ? WHERE id = ? AND salon_id = ?',
      [portfolio.service_id, portfolio.title, portfolio.description, portfolio.media_url, portfolio.media_type, portfolio.id, portfolio.salon_id]
    );
  } else {
    return await query(
      'INSERT INTO salon_portfolio (salon_id, service_id, title, description, media_url, media_type) VALUES (?, ?, ?, ?, ?, ?)',
      [portfolio.salon_id, portfolio.service_id, portfolio.title, portfolio.description, portfolio.media_url, portfolio.media_type]
    );
  }
}

export async function deleteSalonPortfolio(id: number): Promise<void> {
  await query('DELETE FROM salon_portfolio WHERE id = ?', [id]);
}

// --- Product Functions ---

export async function getAllProducts(salonId?: number): Promise<Product[]> {
  const sql = salonId ? 'SELECT id, salon_id, name, price, stock, min_stock, unit, is_active FROM products WHERE salon_id = ?' : 'SELECT id, salon_id, name, price, stock, min_stock, unit, is_active FROM products';
  const rows = await query(sql, salonId ? [salonId] : []);
  return rows as Product[];
}

export async function upsertProduct(product: Partial<Product> & { salon_id: number, name: string }): Promise<any> {
  if (product.id) {
    return await query(
      'UPDATE products SET name = ?, price = ?, stock = ?, min_stock = ?, unit = ? WHERE id = ? AND salon_id = ?',
      [product.name, product.price, product.stock, product.min_stock, product.unit, product.id, product.salon_id]
    );
  } else {
    return await query(
      'INSERT INTO products (salon_id, name, price, stock, min_stock, unit) VALUES (?, ?, ?, ?, ?, ?)',
      [product.salon_id, product.name, product.price, product.stock, product.min_stock, product.unit]
    );
  }
}

export async function deleteProduct(id: number): Promise<void> {
  await query('DELETE FROM products WHERE id = ?', [id]);
}

// ================================================================
// PHASE 2: NEW INTERFACES & FUNCTIONS
// ================================================================

export interface Barber {
  id: number;
  salon_id: number;
  name: string;
  phone?: string;
  email?: string;
  bio?: string;
  experience: number;
  specialization?: string;
  profile_image?: string;
  rating: number;
  review_count: number;
  status: 'active' | 'inactive';
}

export interface BarberPortfolio {
  id: number;
  barber_id: number;
  media_url: string;
  media_type: 'image' | 'video';
  title?: string;
}

export interface BarberSchedule {
  id: number;
  barber_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration: number;
  is_available: boolean;
  break_start?: string;
  break_end?: string;
}

export interface Appointment {
  id: number;
  salon_id: number;
  barber_id: number;
  customer_phone: string;
  customer_name?: string;
  service_id: number;
  appointment_date: string;
  appointment_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  token: string;
  notes?: string;
  salon_name?: string;
  barber_name?: string;
  service_name?: string;
}

export interface Review {
  id: number;
  salon_id: number;
  barber_id?: number;
  customer_phone: string;
  rating: number;
  comment?: string;
}

export interface Offer {
  id: number;
  salon_id: number;
  title: string;
  description?: string;
  discount_percent?: number;
  valid_from?: string;
  valid_until?: string;
  is_active: boolean;
}

export interface Product {
  id: number;
  salon_id: number;
  name: string;
  price: number;
  stock: number;
  min_stock: number;
  unit: string;
}

// --- Barber Functions ---

export async function upsertBarber(barber: { id?: number; salon_id: number; name: string; phone?: string; email?: string; bio?: string; experience?: number; specialization?: string; profile_image?: string; status?: string; pin_code?: string }): Promise<number> {
  if (barber.id) {
    await query(
      'UPDATE barbers SET name = ?, phone = ?, email = ?, bio = ?, experience = ?, specialization = ?, profile_image = ?, status = ?, pin_code = ? WHERE id = ? AND salon_id = ?',
      [barber.name, barber.phone || null, barber.email || null, barber.bio || null, barber.experience || 0, barber.specialization || null, barber.profile_image || null, barber.status || 'active', barber.pin_code || null, barber.id, barber.salon_id]
    );
    return barber.id;
  } else {
    const res: any = await query(
      'INSERT INTO barbers (salon_id, name, phone, email, bio, experience, specialization, profile_image, status, pin_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [barber.salon_id, barber.name, barber.phone || null, barber.email || null, barber.bio || null, barber.experience || 0, barber.specialization || null, barber.profile_image || null, barber.status || 'active', barber.pin_code || null]
    );
    return res.insertId;
  }
}

export async function deleteBarber(id: number, salonId: number): Promise<void> {
  await query('DELETE FROM barber_portfolio WHERE barber_id = ?', [id]);
  await query('DELETE FROM barber_schedule WHERE barber_id = ?', [id]);
  await query('DELETE FROM barber_services WHERE barber_id = ?', [id]);
  await query('DELETE FROM appointments WHERE barber_id = ?', [id]);
  await query('DELETE FROM barbers WHERE id = ? AND salon_id = ?', [id, salonId]);
}

export async function upsertBarberSchedule(schedule: { barber_id: number; day_of_week: number; start_time: string; end_time: string; slot_duration?: number; is_available?: boolean; break_start?: string; break_end?: string }): Promise<number> {
  const existing: any = await query(
    'SELECT id FROM barber_schedule WHERE barber_id = ? AND day_of_week = ?',
    [schedule.barber_id, schedule.day_of_week]
  );
  if (existing.length > 0) {
    await query(
      'UPDATE barber_schedule SET start_time = ?, end_time = ?, slot_duration = ?, is_available = ?, break_start = ?, break_end = ? WHERE id = ?',
      [schedule.start_time, schedule.end_time, schedule.slot_duration || 30, schedule.is_available !== false ? 1 : 0, schedule.break_start || null, schedule.break_end || null, existing[0].id]
    );
    return existing[0].id;
  } else {
    const res: any = await query(
      'INSERT INTO barber_schedule (barber_id, day_of_week, start_time, end_time, slot_duration, is_available, break_start, break_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [schedule.barber_id, schedule.day_of_week, schedule.start_time, schedule.end_time, schedule.slot_duration || 30, schedule.is_available !== false ? 1 : 0, schedule.break_start || null, schedule.break_end || null]
    );
    return res.insertId;
  }
}

export async function deleteBarberSchedule(barberId: number, dayOfWeek?: number): Promise<void> {
  if (dayOfWeek !== undefined) {
    await query('DELETE FROM barber_schedule WHERE barber_id = ? AND day_of_week = ?', [barberId, dayOfWeek]);
  } else {
    await query('DELETE FROM barber_schedule WHERE barber_id = ?', [barberId]);
  }
}

export async function getBarbersBySalon(salonId: number, includePin: boolean = false): Promise<any[]> {
  if (!includePin) {
    const key = `barbers_${salonId}`;
    const cached = cachedQuery(key);
    if (cached) return cached.data as any[];
  }
  const cols = includePin
    ? 'id, salon_id, name, phone, email, bio, experience, specialization, profile_image, rating, review_count, status, pin_code, created_at'
    : 'id, salon_id, name, rating, review_count, experience, specialization, profile_image, status';
  const rows = await query(`SELECT ${cols} FROM barbers WHERE salon_id = ? AND status = 'active' ORDER BY rating DESC`, [salonId]);
  if (!includePin) setCache(`barbers_${salonId}`, rows);
  return rows;
}

export async function getBarberById(id: number): Promise<Barber | null> {
  const rows = await query('SELECT * FROM barbers WHERE id = ?', [id]);
  const barbers = rows as Barber[];
  return barbers.length > 0 ? barbers[0] : null;
}

export async function getBarberPortfolio(barberId: number): Promise<BarberPortfolio[]> {
  const rows = await query('SELECT * FROM barber_portfolio WHERE barber_id = ? ORDER BY created_at DESC', [barberId]);
  return rows as BarberPortfolio[];
}

export async function getBarberSchedule(barberId: number, dayOfWeek?: number): Promise<BarberSchedule[]> {
  let sql = 'SELECT * FROM barber_schedule WHERE barber_id = ?';
  const params: any[] = [barberId];
  if (dayOfWeek !== undefined) {
    sql += ' AND day_of_week = ?';
    params.push(dayOfWeek);
  }
  const rows = await query(sql, params);
  return rows as BarberSchedule[];
}

// --- Service + Barber Linking ---

export async function getBarberServices(barberId: number): Promise<any[]> {
  const rows = await query(`
    SELECT s.id, s.name, s.description, COALESCE(bs.price, s.price) as price, s.duration, s.category
    FROM services s
    LEFT JOIN barber_services bs ON bs.service_id = s.id AND bs.barber_id = ?
    WHERE s.is_active = TRUE
  `, [barberId]);
  return rows as any[];
}

// --- SMART SLOT ENGINE ---

function generateTimeSlots(startTime: string, endTime: string, slotDuration: number, buffer: number = 5): { start: string, end: string }[] {
  const slots: { start: string, end: string }[] = [];
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  let currentMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  while (currentMinutes + slotDuration <= endMinutes) {
    const slotStart = currentMinutes;
    const slotEnd = currentMinutes + slotDuration;
    
    const startStr = `${String(Math.floor(slotStart / 60)).padStart(2, '0')}:${String(slotStart % 60).padStart(2, '0')}`;
    const endStr = `${String(Math.floor(slotEnd / 60)).padStart(2, '0')}:${String(slotEnd % 60).padStart(2, '0')}`;
    
    slots.push({ start: startStr, end: endStr });
    currentMinutes = slotEnd + buffer;
  }
  
  return slots;
}

export async function getAvailableSlots(barberId: number, date: string, buffer: number = 5): Promise<{ start: string, end: string }[]> {
  const cacheKey = `slots_${barberId}_${date}`;
  const cached = cachedQuery(cacheKey, 30000);
  if (cached) return cached.data as { start: string; end: string }[];
  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay();
  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = date === todayStr;
  const currentMinutes = isToday ? new Date().getHours() * 60 + new Date().getMinutes() : 0;

  // Single combined query: barber schedule + salon info + day off + appointments
  const rows: any[] = await query(`
    SELECT 
      bs.start_time AS sched_start, bs.end_time AS sched_end,
      bs.slot_duration, bs.break_start, bs.break_end, bs.is_available,
      wh.start_time AS salon_start, wh.end_time AS salon_end, wh.is_open AS salon_open,
      doff.id AS day_off_id,
      a.appointment_time, a.end_time AS apt_end
    FROM barber_schedule bs
    JOIN barbers b ON b.id = ?
    LEFT JOIN working_hours wh ON wh.salon_id = b.salon_id AND wh.day = ?
    LEFT JOIN day_offs doff ON doff.salon_id = b.salon_id AND doff.date = ? AND doff.is_active = 1
    LEFT JOIN appointments a ON a.barber_id = ? AND a.appointment_date = ?
      AND a.status NOT IN ('cancelled', 'no_show')
    WHERE bs.barber_id = ? AND bs.day_of_week = ?
  `, [barberId, dayOfWeek, date, barberId, date, barberId, dayOfWeek]);

  if (rows.length === 0) return [];
  const r = rows[0];
  if (!r.is_available) return [];
  if (r.day_off_id) return [];
  if (r.salon_open !== null && !r.salon_open) return [];

  const startTime = r.salon_start || r.sched_start;
  const endTime = r.salon_end || r.sched_end;
  const slotDuration = r.slot_duration || 30;

  const allSlots = generateTimeSlots(startTime, endTime, slotDuration, buffer);
  if (allSlots.length === 0) return [];

  // Collect booked slots from all rows
  const bookedSlots = new Set<string>();
  const breakStart = r.break_start ? timeToMinutes(r.break_start) : -1;
  const breakEnd = r.break_end ? timeToMinutes(r.break_end) : -1;
  for (const row of rows) {
    if (row.appointment_time) {
      bookedSlots.add(String(row.appointment_time));
    }
  }

  const availableSlots = allSlots.filter(slot => {
    const slotStart = timeToMinutes(slot.start);
    const slotEnd = timeToMinutes(slot.end);
    if (isToday && slotStart <= currentMinutes) return false;
    if (breakStart >= 0 && breakEnd >= 0) {
      if (slotStart < breakEnd && slotEnd > breakStart) return false;
    }
    if (bookedSlots.has(slot.start)) return false;
    return true;
  });

  setCache(cacheKey, availableSlots, 30000);
  return availableSlots;
}

// --- Appointment Functions ---

export async function createAppointment(data: {
  salon_id: number;
  barber_id: number;
  customer_phone: string;
  customer_name?: string;
  service_id: number;
  appointment_date: string;
  appointment_time: string;
  end_time: string;
  token: string;
}): Promise<{ success: boolean; id?: number; error?: string }> {
  try {
    const res: any = await query(
      `INSERT INTO appointments (salon_id, barber_id, customer_phone, customer_name, service_id, appointment_date, appointment_time, end_time, token, status)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed'
       WHERE NOT EXISTS (
         SELECT 1 FROM appointments
         WHERE barber_id = ? AND appointment_date = ? AND appointment_time = ?
         AND status NOT IN ('cancelled', 'no_show')
       )`,
      [data.salon_id, data.barber_id, data.customer_phone, data.customer_name, data.service_id, data.appointment_date, data.appointment_time, data.end_time, data.token,
       data.barber_id, data.appointment_date, data.appointment_time]
    );
    if (!res || res.affectedRows === 0) {
      return { success: false, error: 'Yeh slot already booked hai.' };
    }
    clearCache(`slots_${data.barber_id}_${data.appointment_date}`);
    return { success: true, id: res.insertId };
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') {
      return { success: false, error: 'Yeh slot already booked hai.' };
    }
    throw err;
  }
}

export async function getAppointmentsByBarberAndDate(barberId: number, date: string): Promise<Appointment[]> {
  const rows = await query(
    `SELECT id, salon_id, barber_id, customer_phone, customer_name, service_id, appointment_date, appointment_time, end_time, status, token, notes FROM appointments WHERE barber_id = ? AND appointment_date = ? AND status NOT IN ('cancelled', 'no_show') ORDER BY appointment_time`,
    [barberId, date]
  );
  return rows as Appointment[];
}

export async function getCurrentAppointment(barberId: number): Promise<Appointment | null> {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const rows = await query(
    `SELECT id, salon_id, barber_id, customer_phone, customer_name, service_id, appointment_date, appointment_time, end_time, status, token, notes FROM appointments 
     WHERE barber_id = ? AND appointment_date = ? AND status = 'in_progress'
     LIMIT 1`,
    [barberId, today]
  ) as Appointment[];
  
  return rows.length > 0 ? rows[0] : null;
}

export async function getAppointmentByToken(token: string): Promise<Appointment | null> {
  const rows = await query(
    `SELECT a.*, s.name as service_name, b.name as barber_name, sl.name as salon_name 
     FROM appointments a
     JOIN services s ON a.service_id = s.id
     JOIN barbers b ON a.barber_id = b.id
     JOIN salons sl ON a.salon_id = sl.id
     WHERE a.token = ?`,
    [token]
  ) as any[];
  return rows.length > 0 ? rows[0] : null;
}

export async function cancelAppointmentByToken(token: string): Promise<boolean> {
  const res: any = await query(
    "UPDATE appointments SET status = 'cancelled' WHERE token = ? AND status IN ('pending', 'confirmed')",
    [token]
  );
  return res.affectedRows > 0;
}

export async function getCustomerByPhone(phone: string): Promise<any> {
  let normalizedPhone = phone.replace(/@s\.whatsapp\.net$/, '').replace(/@(newsletter|lid|g\.us|broadcast)$/, '');
  normalizedPhone = normalizedPhone.replace(/[^\d]/g, '');
  while (normalizedPhone.length > 0 && normalizedPhone[0] === '0') {
    normalizedPhone = normalizedPhone.slice(1);
  }
  const rows = await query('SELECT * FROM customers WHERE phone = ?', [normalizedPhone]);
  return rows.length > 0 ? rows[0] : null;
}

export async function getCustomerPasswordHash(phone: string): Promise<string | null> {
  try {
    const rows = await query('SELECT password_hash FROM customers WHERE phone = ?', [phone]);
    return rows.length > 0 ? rows[0]?.password_hash : null;
  } catch {
    return null;
  }
}

export async function updateCustomerPassword(phone: string, hash: string): Promise<void> {
  await query('UPDATE customers SET password_hash = ?, has_set_password = 1 WHERE phone = ?', [hash, phone]);
}

export async function addCustomerPoints(phone: string, points: number): Promise<void> {
  await query('UPDATE customers SET global_points = global_points + ? WHERE phone = ?', [points, phone]);
}

export async function getCustomerByReferralCode(code: string): Promise<Customer | null> {
  const rows: any = await query('SELECT * FROM customers WHERE referral_code = ?', [code]);
  return rows.length > 0 ? rows[0] : null;
}

export async function upsertCustomer(name: string, phone: string): Promise<void> {
  let normalizedPhone = phone.replace(/[^\d]/g, '');
  while (normalizedPhone.length > 0 && normalizedPhone[0] === '0') {
    normalizedPhone = normalizedPhone.slice(1);
  }
  await query(
    'INSERT INTO customers (phone, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = ?',
    [normalizedPhone, name, name]
  );
}

export async function addLoyaltyPoints(phone: string, points: number): Promise<void> {
  await query(
    'UPDATE customers SET loyalty_points = loyalty_points + ?, total_visits = total_visits + 1 WHERE phone = ?',
    [points, phone]
  );
}

// --- Review Functions ---

export async function createReview(data: {
  salon_id: number;
  barber_id?: number;
  customer_phone: string;
  rating: number;
  comment?: string;
}): Promise<number> {
  const res: any = await query(
    'INSERT INTO reviews (salon_id, barber_id, customer_phone, rating, comment) VALUES (?, ?, ?, ?, ?)',
    [data.salon_id, data.barber_id || null, data.customer_phone, data.rating, data.comment || null]
  );
  if (data.salon_id) clearCache(`salon_${data.salon_id}`);
  return res.insertId;
}

// --- Offer Functions ---

export async function createOffer(data: { salon_id: number; title: string; description?: string; discount_percent?: number; valid_from?: string; valid_until?: string }): Promise<number> {
  const res: any = await query(
    'INSERT INTO offers (salon_id, title, description, discount_percent, valid_from, valid_until) VALUES (?, ?, ?, ?, ?, ?)',
    [data.salon_id, data.title, data.description || null, data.discount_percent || null, data.valid_from || null, data.valid_until || null]
  );
  clearCache(`offers_${data.salon_id}`);
  clearCache('active_offers');
  return res.insertId;
}

export async function updateOffer(id: number, salonId: number, data: { title?: string; description?: string; discount_percent?: number; valid_from?: string; valid_until?: string; is_active?: boolean }): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  if (data.title !== undefined) { sets.push('title = ?'); params.push(data.title); }
  if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description); }
  if (data.discount_percent !== undefined) { sets.push('discount_percent = ?'); params.push(data.discount_percent); }
  if (data.valid_from !== undefined) { sets.push('valid_from = ?'); params.push(data.valid_from); }
  if (data.valid_until !== undefined) { sets.push('valid_until = ?'); params.push(data.valid_until); }
  if (data.is_active !== undefined) { sets.push('is_active = ?'); params.push(data.is_active ? 1 : 0); }
  if (sets.length === 0) return;
  params.push(id, salonId);
  await query(`UPDATE offers SET ${sets.join(', ')} WHERE id = ? AND salon_id = ?`, params);
}

export async function deleteOffer(id: number, salonId: number): Promise<void> {
  await query('DELETE FROM offers WHERE id = ? AND salon_id = ?', [id, salonId]);
}

export async function getAllOffersForSalon(salonId: number): Promise<Offer[]> {
  const rows = await query('SELECT id, salon_id, title, description, discount_percent, valid_from, valid_until, is_active FROM offers WHERE salon_id = ? ORDER BY created_at DESC', [salonId]);
  return rows as Offer[];
}

export async function getOffersBySalon(salonId: number): Promise<Offer[]> {
  const key = `offers_${salonId}`;
  const cached = cachedQuery(key, 60000);
  if (cached) return cached.data as Offer[];
  const today = new Date().toISOString().split('T')[0];
  const rows = await query(
    "SELECT id, salon_id, title, description, discount_percent, valid_from, valid_until, is_active FROM offers WHERE salon_id = ? AND is_active = TRUE AND valid_from <= ? AND valid_until >= ?",
    [salonId, today, today]
  );
  setCache(key, rows, 60000);
  return rows as Offer[];
}

// --- Salon Detail (enhanced) ---

export async function getSalonDetailForBot(salonId: number): Promise<any> {
  const rows = await query(`
    SELECT s.id, s.name, s.owner_name, s.phone, s.email, s.country_id, s.city_id, s.area_id, s.address, s.cover_image_url, s.logo_url, s.description, s.status, s.rating, s.review_count, s.assigned_admin_id, s.latitude, s.longitude, s.commission_rate, s.commission_type, s.created_at, c.name as city_name, a.name as area_name 
    FROM salons s
    LEFT JOIN cities c ON s.city_id = c.id
    LEFT JOIN areas a ON s.area_id = a.id
    WHERE s.id = ?
  `, [salonId]);
  return rows.length > 0 ? rows[0] : null;
}

export async function getSalonMedia(salonId: number): Promise<any[]> {
  return await query('SELECT * FROM salon_media WHERE salon_id = ? ORDER BY is_cover DESC', [salonId]) as any[];
}

export async function getSalonReviews(salonId: number, limit: number = 5): Promise<any[]> {
  return await query(
    `SELECT r.*, c.name as customer_name 
     FROM reviews r 
     LEFT JOIN customers c ON r.customer_phone = c.phone 
     WHERE r.salon_id = ? 
     ORDER BY r.created_at DESC LIMIT ?`,
    [salonId, limit]
  ) as any[];
}

export async function updateReview(id: number, data: { rating?: number; comment?: string }): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  if (data.rating !== undefined) { sets.push('rating = ?'); params.push(data.rating); }
  if (data.comment !== undefined) { sets.push('comment = ?'); params.push(data.comment); }
  if (sets.length === 0) return;
  const nowExpr = process.env.USE_SQLITE === 'true' ? "datetime('now')" : 'NOW()';
  sets.push(`updated_at = ${nowExpr}`);
  params.push(id);
  await query(`UPDATE reviews SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function deleteReview(id: number): Promise<void> {
  await query('DELETE FROM reviews WHERE id = ?', [id]);
}

// --- Expense Functions (for Finances page) ---

export async function getAllExpenses(): Promise<any[]> {
  const rows = await query('SELECT id, salon_id, description, amount, category, date FROM expenses ORDER BY date DESC');
  return rows as any[];
}

export async function deleteExpense(id: number): Promise<void> {
  await query('DELETE FROM expenses WHERE id = ?', [id]);
}

export async function updateExpense(id: number, data: { description?: string; amount?: number; category?: string; date?: string }): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description); }
  if (data.amount !== undefined) { sets.push('amount = ?'); params.push(data.amount); }
  if (data.category !== undefined) { sets.push('category = ?'); params.push(data.category); }
  if (data.date !== undefined) { sets.push('date = ?'); params.push(data.date); }
  if (sets.length === 0) return;
  params.push(id);
  await query(`UPDATE expenses SET ${sets.join(', ')} WHERE id = ?`, params);
}

// --- Revenue Functions (for Finances page) ---

export async function getAllRevenue(): Promise<any[]> {
  const rows = await query('SELECT id, salon_id, amount, date FROM revenue ORDER BY date DESC');
  return rows as any[];
}

export async function deleteRevenue(id: number): Promise<void> {
  await query('DELETE FROM revenue WHERE id = ?', [id]);
}

export async function updateRevenue(id: number, data: { amount?: number; date?: string }): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  if (data.amount !== undefined) { sets.push('amount = ?'); params.push(data.amount); }
  if (data.date !== undefined) { sets.push('date = ?'); params.push(data.date); }
  if (sets.length === 0) return;
  params.push(id);
  await query(`UPDATE revenue SET ${sets.join(', ')} WHERE id = ?`, params);
}

// --- Customer CRUD ---

export async function deleteCustomer(phone: string): Promise<void> {
  await query('DELETE FROM customers WHERE phone = ?', [phone]);
}

export async function upsertCustomerFull(data: { phone: string; name: string; tags?: string[] }): Promise<void> {
  await query(
    'INSERT INTO customers (phone, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = ?',
    [data.phone, data.name, data.name]
  );
  if (data.tags && data.tags.length > 0) {
    await query('DELETE FROM customer_tags WHERE customer_phone = ?', [data.phone]);
    for (const tag of data.tags) {
      await query(
        'INSERT IGNORE INTO customer_tags (customer_phone, tag) VALUES (?, ?)',
        [data.phone, tag]
      );
    }
  }
}

// --- Chat/Messages Functions (for Inbox page) ---

export async function getChatContacts(sessionId?: string): Promise<any[]> {
  const sql = sessionId
    ? `SELECT phone, push_name as name, MAX(text) as lastMessage, MAX(timestamp) as timestamp
       FROM messages WHERE session_id = ? AND phone NOT LIKE '%@broadcast' AND phone NOT LIKE '%@g.us'
       GROUP BY phone, push_name ORDER BY timestamp DESC`
    : `SELECT phone, push_name as name, MAX(text) as lastMessage, MAX(timestamp) as timestamp
       FROM messages WHERE phone NOT LIKE '%@broadcast' AND phone NOT LIKE '%@g.us'
       GROUP BY phone, push_name ORDER BY timestamp DESC`;
  const rows = await query(sql, sessionId ? [sessionId] : []);
  return rows as any[];
}

export async function getChatMessages(phone: string): Promise<any[]> {
  const rows = await query(
    `SELECT id, phone, push_name as pushName, text, from_me as fromMe, timestamp
     FROM messages WHERE phone = ? ORDER BY timestamp ASC`,
    [phone]
  );
  return rows as any[];
}

export async function saveChatMessage(msg: {
  sessionId?: string;
  phone: string;
  pushName?: string;
  text: string;
  fromMe: boolean;
}): Promise<void> {
  await query(
    'INSERT INTO messages (session_id, phone, push_name, text, from_me) VALUES (?, ?, ?, ?, ?)',
    [msg.sessionId || null, msg.phone, msg.pushName || null, msg.text, msg.fromMe ? 1 : 0]
  );
}

// --- Customer Activity ---
export async function updateCustomerActivity(phone: string): Promise<void> {
  if (process.env.USE_SQLITE === 'true') {
    const today = new Date().toISOString().split('T')[0];
    await query(
      "INSERT INTO customers (phone, last_active, status) VALUES (?, ?, 'Active') ON CONFLICT(phone) DO UPDATE SET last_active = ?, status = 'Active'",
      [phone, today, today]
    );
  } else {
    const today = new Date().toISOString().split('T')[0];
    await query(
      "INSERT INTO customers (phone, last_active, status) VALUES (?, ?, 'Active') ON DUPLICATE KEY UPDATE last_active = VALUES(last_active), status = 'Active'",
      [phone, today]
    );
  }
}

export async function getSalonCustomerChats(salonId: number): Promise<any[]> {
  const rows = await query(
    `SELECT DISTINCT m.phone, m.push_name as name, MAX(m.text) as lastMessage, MAX(m.timestamp) as timestamp
     FROM messages m
     LEFT JOIN appointments a ON a.customer_phone = REPLACE(m.phone, '@s.whatsapp.net', '') AND a.salon_id = ?
     WHERE a.id IS NOT NULL
     GROUP BY m.phone, m.push_name ORDER BY timestamp DESC`,
    [salonId]
  );
  return rows as any[];
}

// --- Bot Paused State ---

export async function getBotPausedStatus(phone: string): Promise<boolean> {
  const rows: any = await query('SELECT paused FROM bot_paused WHERE phone = ?', [phone]);
  return rows.length > 0 ? !!rows[0].paused : false;
}

export async function setBotPausedStatus(phone: string, paused: boolean): Promise<void> {
  await query(
    'INSERT INTO bot_paused (phone, paused) VALUES (?, ?) ON DUPLICATE KEY UPDATE paused = ?',
    [phone, paused ? 1 : 0, paused ? 1 : 0]
  );
}

// ================================================================
// SUPER ADMIN NEW FEATURES (Jun 2026)
// ================================================================

export interface Admin {
  id: number;
  name: string;
  email: string;
  password?: string;
  role: 'super_admin' | 'admin' | 'support' | 'viewer';
  is_active: boolean;
  last_login?: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  admin_id?: number;
  admin_email?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string;
  ip_address?: string;
  created_at: string;
}

export interface PlatformSetting {
  id: number;
  setting_key: string;
  setting_value: string;
  setting_type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
}

export interface Payout {
  id: number;
  salon_id: number;
  amount: number;
  method: 'bank' | 'jazzcash' | 'easypaisa' | 'other';
  account_details?: string;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  admin_notes?: string;
  requested_at: string;
  processed_at?: string;
  processed_by?: number;
  salon_name?: string;
  owner_name?: string;
}

export interface Dispute {
  id: number;
  salon_id?: number;
  customer_phone?: string;
  appointment_id?: number;
  title: string;
  description?: string;
  status: 'open' | 'under_review' | 'resolved' | 'closed';
  resolution?: string;
  resolved_by?: number;
  created_at: string;
  resolved_at?: string;
  salon_name?: string;
  customer_name?: string;
}

export interface Coupon {
  id: number;
  code: string;
  type: 'percentage' | 'flat';
  value: number;
  min_amount: number;
  max_uses: number;
  used_count: number;
  valid_from?: string;
  valid_until?: string;
  is_active: boolean;
  created_at: string;
}

export interface Template {
  id: number;
  name: string;
  type: 'email' | 'sms' | 'whatsapp';
  subject?: string;
  body: string;
  variables?: string;
  is_active: boolean;
  created_at: string;
}

export interface BroadcastNotification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'urgent';
  target: 'all_salons' | 'active_salons' | 'all_customers';
  status: 'draft' | 'sent' | 'scheduled';
  scheduled_at?: string;
  sent_at?: string;
  sent_by?: number;
  created_at: string;
}

// --- Admin Functions ---

export async function getAllAdmins(): Promise<Admin[]> {
  const rows = await query('SELECT id, name, email, role, is_active, last_login, created_at FROM admins ORDER BY created_at DESC');
  return rows as Admin[];
}

export async function getAdminById(id: number): Promise<Admin | null> {
  const rows = await query('SELECT id, name, email, role, is_active, last_login, created_at FROM admins WHERE id = ?', [id]);
  return rows.length > 0 ? rows[0] : null;
}

export async function getAdminByEmail(email: string): Promise<Admin | null> {
  const rows = await query('SELECT * FROM admins WHERE email = ?', [email]);
  return rows.length > 0 ? rows[0] : null;
}

export async function createAdmin(data: { name: string; email: string; password: string; role: string }): Promise<number> {
   const hash = await (await import('bcryptjs')).hash(data.password, 10);
   const nowFunc = process.env.USE_SQLITE === 'true' ? "datetime('now')" : 'NOW()';
   const r: any = await query(
     `INSERT INTO admins (name, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ${nowFunc}, ${nowFunc})`,
     [data.name, data.email, hash, data.role]
   );
   return r.insertId;
}

export async function updateAdmin(id: number, data: { name?: string; email?: string; role?: string; is_active?: boolean }): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
  if (data.email !== undefined) { sets.push('email = ?'); params.push(data.email); }
  if (data.role !== undefined) { sets.push('role = ?'); params.push(data.role); }
  if (data.is_active !== undefined) { sets.push('is_active = ?'); params.push(data.is_active ? 1 : 0); }
  if (sets.length > 0) {
    params.push(id);
    await query(`UPDATE admins SET ${sets.join(', ')} WHERE id = ?`, params);
  }
}

export async function deleteAdmin(id: number): Promise<void> {
  await query("DELETE FROM admins WHERE id = ? AND role != 'super_admin'", [id]);
}

export async function updateAdminLogin(id: number): Promise<void> {
  if (process.env.USE_SQLITE === 'true') {
    await query("UPDATE admins SET last_login = datetime('now') WHERE id = ?", [id]);
  } else {
    await query('UPDATE admins SET last_login = NOW() WHERE id = ?', [id]);
  }
}

// --- Audit Log Functions ---

export async function createAuditLog(log: {
  admin_id?: number;
  admin_email?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string;
  ip_address?: string;
}): Promise<void> {
  let adminEmail = log.admin_email || null;
  // Backfill the email from the admins table when it was not supplied.
  if (!adminEmail && log.admin_id) {
    try {
      const rows: any = await query('SELECT email FROM admins WHERE id = ?', [log.admin_id]);
      adminEmail = rows?.[0]?.email || null;
    } catch (e) {
      adminEmail = null;
    }
  }
  await query(
    'INSERT INTO audit_logs (admin_id, admin_email, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [log.admin_id || null, adminEmail, log.action, log.entity_type || null, log.entity_id || null, log.details || null, log.ip_address || null]
  );
}

export async function getAuditLogs(limit: number = 100, offset: number = 0): Promise<AuditLog[]> {
  const rows = await query('SELECT id, admin_id, admin_email, action, entity_type, entity_id, details, ip_address, created_at FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]);
  return rows as AuditLog[];
}

export async function getAuditLogsCount(): Promise<number> {
  const rows: any = await query('SELECT COUNT(*) as total FROM audit_logs');
  return rows[0]?.total || 0;
}

export async function createPendingBooking(data: {
  salon_id: number;
  customer_phone: string;
  customer_name: string;
  service_id: number;
  barber_id?: number;
  appointment_date: string;
  appointment_time: string;
}): Promise<number> {
  const res: any = await query(
    `INSERT INTO pending_bookings (salon_id, customer_phone, customer_name, service_id, barber_id, appointment_date, appointment_time)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.salon_id, data.customer_phone, data.customer_name, data.service_id, data.barber_id || null, data.appointment_date, data.appointment_time]
  );
  return res.insertId;
}

export async function getPendingBookings(salonId?: number): Promise<any[]> {
  const sql = salonId
    ? `SELECT id, salon_id, customer_phone, customer_name, service_id, barber_id, appointment_date, appointment_time, status, created_at FROM pending_bookings WHERE salon_id = ? ORDER BY created_at DESC`
    : `SELECT id, salon_id, customer_phone, customer_name, service_id, barber_id, appointment_date, appointment_time, status, created_at FROM pending_bookings ORDER BY created_at DESC`;
  const rows = await query(sql, salonId ? [salonId] : []);
  return rows;
}

export async function flushPendingBookings(salonId: number): Promise<{ flushed: number; failed: number }> {
  const pending = await getPendingBookings(salonId);
  let flushed = 0;
  let failed = 0;
  for (const pb of pending) {
    try {
      const token = Math.random().toString(36).slice(2, 8).toUpperCase();
      const result = await createAppointment({
        salon_id: pb.salon_id,
        barber_id: pb.barber_id || 0,
        customer_phone: pb.customer_phone,
        customer_name: pb.customer_name,
        service_id: pb.service_id,
        appointment_date: pb.appointment_date,
        appointment_time: pb.appointment_time,
        end_time: pb.appointment_time,
        token,
      });
      if (result.success) {
        await query('UPDATE pending_bookings SET status = ? WHERE id = ?', ['flushed', pb.id]);
        flushed++;
      } else {
        failed++;
      }
    } catch (_) {
      failed++;
    }
  }
  return { flushed, failed };
}

export async function deletePendingBooking(id: number): Promise<void> {
  await query('DELETE FROM pending_bookings WHERE id = ?', [id]);
}

// --- Platform Settings Functions ---

export async function getAllSettings(): Promise<PlatformSetting[]> {
  const rows = await query('SELECT id, setting_key, setting_value, setting_type, description, updated_at FROM platform_settings ORDER BY setting_key');
  return rows as PlatformSetting[];
}

export async function getSetting(key: string): Promise<string | null> {
  const rows: any = await query('SELECT setting_value FROM platform_settings WHERE setting_key = ?', [key]);
  return rows.length > 0 ? rows[0].setting_value : null;
}

export async function upsertSetting(setting: { setting_key: string; setting_value: string; setting_type?: string; description?: string; updated_by?: number }): Promise<void> {
   const nowFunc = process.env.USE_SQLITE === 'true' ? "datetime('now')" : 'NOW()';
   if (process.env.USE_SQLITE === 'true') {
     await query(
       `INSERT INTO platform_settings (setting_key, setting_value, setting_type, description, updated_by, updated_at) 
        VALUES (?, ?, ?, ?, ?, ${nowFunc}) 
        ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, setting_type = excluded.setting_type, description = excluded.description, updated_by = excluded.updated_by, updated_at = ${nowFunc}`,
       [setting.setting_key, setting.setting_value, setting.setting_type || 'string', setting.description || null, setting.updated_by || null]
     );
   } else {
     await query(
       `INSERT INTO platform_settings (setting_key, setting_value, setting_type, description, updated_by, updated_at) 
        VALUES (?, ?, ?, ?, ?, ${nowFunc}) 
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), setting_type = VALUES(setting_type), description = VALUES(description), updated_by = VALUES(updated_by), updated_at = ${nowFunc}`,
       [setting.setting_key, setting.setting_value, setting.setting_type || 'string', setting.description || null, setting.updated_by || null]
     );
   }
 }

export async function deleteSetting(key: string): Promise<void> {
  await query('DELETE FROM platform_settings WHERE setting_key = ?', [key]);
}

// --- Payout Functions ---

export async function getPayouts(status?: string): Promise<Payout[]> {
  let sql = `SELECT p.*, s.name as salon_name, s.owner_name FROM payouts p JOIN salons s ON p.salon_id = s.id`;
  const params: any[] = [];
  if (status) { sql += ' WHERE p.status = ?'; params.push(status); }
  sql += ' ORDER BY p.created_at DESC';
  const rows = await query(sql, params);
  return rows as Payout[];
}

export async function getPayoutsBySalon(salonId: number): Promise<Payout[]> {
  const rows = await query('SELECT id, salon_id, barber_id, amount, method, status, period_start, period_end, processed_at, admin_notes, created_at FROM payouts WHERE salon_id = ? ORDER BY created_at DESC', [salonId]);
  return rows as Payout[];
}

export async function createPayout(data: { salon_id: number; amount: number; method?: string; account_details?: string; barber_id?: number; notes?: string }): Promise<number> {
  const r: any = await query(
    'INSERT INTO payouts (salon_id, barber_id, amount, method, account_details, admin_notes) VALUES (?, ?, ?, ?, ?, ?)',
    [data.salon_id, data.barber_id || null, data.amount, data.method || 'bank', data.account_details || null, data.notes || null]
  );
  return r.insertId;
}

export async function updatePayoutStatus(id: number, status: string, adminId: number, notes?: string): Promise<void> {
  const nowExpr = process.env.USE_SQLITE === 'true' ? "datetime('now')" : 'NOW()';
  await query(
    `UPDATE payouts SET status = ?, processed_at = ${nowExpr}, processed_by = ?, admin_notes = ? WHERE id = ?`,
    [status, adminId, notes || null, id]
  );
}

// --- Dispute Functions ---

export async function getDisputes(status?: string): Promise<Dispute[]> {
  let sql = `SELECT d.*, s.name as salon_name, c.name as customer_name FROM disputes d LEFT JOIN salons s ON d.salon_id = s.id LEFT JOIN customers c ON d.customer_phone = c.phone`;
  const params: any[] = [];
  if (status) { sql += ' WHERE d.status = ?'; params.push(status); }
  sql += ' ORDER BY d.created_at DESC';
  const rows = await query(sql, params);
  return rows as Dispute[];
}

export async function createDispute(data: { salon_id?: number; customer_phone?: string; appointment_id?: number; title: string; description?: string }): Promise<number> {
  const r: any = await query(
    'INSERT INTO disputes (salon_id, customer_phone, appointment_id, title, description) VALUES (?, ?, ?, ?, ?)',
    [data.salon_id || null, data.customer_phone || null, data.appointment_id || null, data.title, data.description || null]
  );
  return r.insertId;
}

export async function updateDisputeStatus(id: number, status: string, resolution: string, adminId: number): Promise<void> {
  const nowExpr = process.env.USE_SQLITE === 'true' ? "datetime('now')" : 'NOW()';
  await query(
    `UPDATE disputes SET status = ?, resolution = ?, resolved_by = ?, resolved_at = ${nowExpr} WHERE id = ?`,
    [status, resolution, adminId, id]
  );
}

// --- Coupon Functions ---

export async function getCoupons(): Promise<Coupon[]> {
  const rows = await query('SELECT id, code, type, value, min_amount, max_uses, used_count, valid_from, valid_until, is_active, created_at FROM coupons ORDER BY created_at DESC');
  return rows as Coupon[];
}

export async function createCoupon(data: { code: string; type: string; value: number; min_amount?: number; max_uses?: number; valid_from?: string; valid_until?: string; created_by?: number }): Promise<number> {
  const r: any = await query(
    'INSERT INTO coupons (code, type, value, min_amount, max_uses, valid_from, valid_until, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [data.code.toUpperCase(), data.type, data.value, data.min_amount || 0, data.max_uses || 0, data.valid_from || null, data.valid_until || null, data.created_by || null]
  );
  return r.insertId;
}

export async function updateCoupon(id: number, data: { code?: string; type?: string; value?: number; min_amount?: number; max_uses?: number; valid_from?: string; valid_until?: string; updated_by?: number }): Promise<void> {
  const fields: string[] = [];
  const params: any[] = [];
  if (data.code !== undefined) { fields.push('code = ?'); params.push(data.code.toUpperCase()); }
  if (data.type !== undefined) { fields.push('type = ?'); params.push(data.type); }
  if (data.value !== undefined) { fields.push('value = ?'); params.push(data.value); }
  if (data.min_amount !== undefined) { fields.push('min_amount = ?'); params.push(data.min_amount); }
  if (data.max_uses !== undefined) { fields.push('max_uses = ?'); params.push(data.max_uses); }
  if (data.valid_from !== undefined) { fields.push('valid_from = ?'); params.push(data.valid_from); }
  if (data.valid_until !== undefined) { fields.push('valid_until = ?'); params.push(data.valid_until); }
  if (fields.length === 0) return;
  await query(`UPDATE coupons SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
}

export async function deleteCoupon(id: number): Promise<void> {
  await query('DELETE FROM coupons WHERE id = ?', [id]);
}

// --- Template Functions ---

export async function getTemplates(): Promise<Template[]> {
  const rows = await query('SELECT id, name, type, subject, body, variables, is_active, created_at FROM templates ORDER BY name');
  return rows as Template[];
}

export async function getTemplateByName(name: string): Promise<Template | null> {
  const rows = await query('SELECT id, name, type, subject, body, variables, is_active, created_at FROM templates WHERE name = ?', [name]);
  return rows.length > 0 ? rows[0] : null;
}

export async function upsertTemplate(data: { id?: number; name: string; type: string; subject?: string; body: string; variables?: string; is_active?: boolean; updated_by?: number }): Promise<void> {
  if (data.id) {
    await query(
      'UPDATE templates SET name = ?, type = ?, subject = ?, body = ?, variables = ?, is_active = ?, updated_by = ? WHERE id = ?',
      [data.name, data.type, data.subject || null, data.body, data.variables || null, data.is_active !== false ? 1 : 0, data.updated_by || null, data.id]
    );
  } else {
    await query(
      'INSERT INTO templates (name, type, subject, body, variables, is_active, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [data.name, data.type, data.subject || null, data.body, data.variables || null, data.is_active !== false ? 1 : 0, data.updated_by || null]
    );
  }
}

export async function deleteTemplate(id: number): Promise<void> {
  await query('DELETE FROM templates WHERE id = ?', [id]);
}

// --- Broadcast Notification Functions ---

export async function getBroadcastNotifications(): Promise<BroadcastNotification[]> {
  const rows = await query('SELECT id, salon_id, title, message, target, status, scheduled_at, sent_at, created_at FROM broadcast_notifications ORDER BY created_at DESC');
  return rows as BroadcastNotification[];
}

export async function createBroadcastNotification(data: { title: string; message: string; type?: string; target?: string; status?: string; sent_by?: number }): Promise<number> {
  const r: any = await query(
    'INSERT INTO broadcast_notifications (title, message, type, target, status, sent_by) VALUES (?, ?, ?, ?, ?, ?)',
    [data.title, data.message, data.type || 'info', data.target || 'all_salons', data.status || 'draft', data.sent_by || null]
  );
  return r.insertId;
}

export async function sendBroadcastNotification(id: number): Promise<void> {
  const nowExpr = process.env.USE_SQLITE === 'true' ? "datetime('now')" : 'NOW()';
  await query(
    `UPDATE broadcast_notifications SET status = 'sent', sent_at = ${nowExpr} WHERE id = ?`,
    [id]
  );
}

// --- System Health ---

export async function getSystemHealth(): Promise<any> {
  let dbAlive = true;
  try {
    if (process.env.USE_SQLITE === 'true') {
      (pool as any).prepare('SELECT 1 as alive').get();
    } else {
      const [dbCheck] = await (pool as mysql.Pool).execute('SELECT 1 as alive') as any[];
      dbAlive = dbCheck && dbCheck[0]?.alive === 1;
    }
  } catch {
    dbAlive = false;
  }
  return { database: dbAlive ? 'healthy' : 'unhealthy', timestamp: new Date().toISOString() };
}

// --- Reports & Export ---

export async function getReportData(type: string, params: any = {}): Promise<any[]> {
  switch (type) {
    case 'salons':
      return await query('SELECT s.*, c.name as country_name, ct.name as city_name, a.name as area_name FROM salons s LEFT JOIN countries c ON s.country_id = c.id LEFT JOIN cities ct ON s.city_id = ct.id LEFT JOIN areas a ON s.area_id = a.id ORDER BY s.created_at DESC');
    case 'appointments':
      return await query(`SELECT a.*, b.name as barber_name, s.name as service_name, sl.name as salon_name FROM appointments a JOIN barbers b ON a.barber_id = b.id JOIN services s ON a.service_id = s.id JOIN salons sl ON a.salon_id = sl.id ORDER BY a.created_at DESC`);
    case 'customers':
      return await query(`SELECT c.*, COUNT(DISTINCT a.id) as total_visits, MAX(a.appointment_date) as last_visit FROM customers c LEFT JOIN appointments a ON c.phone = a.customer_phone GROUP BY c.phone ORDER BY c.created_at DESC`);
    case 'revenue':
      return await query(`SELECT sl.name as salon_name, COALESCE(SUM(s.price), 0) as revenue, COUNT(a.id) as bookings FROM appointments a JOIN services s ON a.service_id = s.id JOIN salons sl ON a.salon_id = sl.id WHERE a.status = 'completed' GROUP BY sl.id ORDER BY revenue DESC`);
    default:
      return [];
  }
}

// --- Salon Commission ---

export async function updateSalonCommission(id: number, commissionRate: number, commissionType: string): Promise<void> {
  await query('UPDATE salons SET commission_rate = ?, commission_type = ? WHERE id = ?', [commissionRate, commissionType, id]);
}

// ================================================================
// BOT FEATURES (Jun 2026)
// ================================================================

export async function updateAppointmentByToken(token: string, data: {
  appointment_date?: string;
  appointment_time?: string;
  end_time?: string;
  barber_id?: number;
}): Promise<boolean> {
  const sets: string[] = [];
  const params: any[] = [];
  if (data.appointment_date) { sets.push('appointment_date = ?'); params.push(data.appointment_date); }
  if (data.appointment_time) { sets.push('appointment_time = ?'); params.push(data.appointment_time); }
  if (data.end_time) { sets.push('end_time = ?'); params.push(data.end_time); }
  if (data.barber_id) { sets.push('barber_id = ?'); params.push(data.barber_id); }
  if (sets.length === 0) return false;
  sets.push("status = 'confirmed'");
  params.push(token);
  const res: any = await query(`UPDATE appointments SET ${sets.join(', ')} WHERE token = ? AND status IN ('pending', 'confirmed')`, params);
  return res.affectedRows > 0;
}

export async function getCustomerPreference(phone: string, prefKey: string): Promise<string | null> {
  const rows: any = await query('SELECT pref_value FROM customer_preferences WHERE phone = ? AND pref_key = ?', [phone, prefKey]);
  return rows.length > 0 ? rows[0].pref_value : null;
}

export async function setCustomerPreference(phone: string, prefKey: string, prefValue: string): Promise<void> {
  await query(
    'INSERT INTO customer_preferences (phone, pref_key, pref_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE pref_value = ?',
    [phone, prefKey, prefValue, prefValue]
  );
}

export async function getOrCreateReferralCode(phone: string, name: string): Promise<string> {
  const existing: any = await query('SELECT referral_code FROM customers WHERE phone = ? AND referral_code IS NOT NULL', [phone]);
  if (existing.length > 0) return existing[0].referral_code;
  const code = (name.slice(0, 3).toUpperCase() || 'REF') + Math.random().toString(36).slice(2, 6).toUpperCase();
  await query('UPDATE customers SET referral_code = ? WHERE phone = ?', [code, phone]);
  return code;
}

export async function getActiveOffersAll(): Promise<any[]> {
  const cached = cachedQuery('active_offers', 60000);
  if (cached) return cached.data as any[];
  const today = new Date().toISOString().split('T')[0];
  const rows = await query(
    `SELECT o.*, s.name as salon_name FROM offers o
     JOIN salons s ON o.salon_id = s.id
     WHERE o.is_active = TRUE AND o.valid_from <= ? AND o.valid_until >= ?`,
    [today, today]
  );
  setCache('active_offers', rows, 60000);
  return rows as any[];
}

export async function getSalonsByCityName(cityName: string): Promise<any[]> {
  const rows = await query(
    `SELECT s.* FROM salons s
     JOIN cities c ON s.city_id = c.id
     WHERE c.name LIKE ? AND s.status = 'active'`,
    [`%${cityName}%`]
  );
  return rows as any[];
}

// ─── Recurring Bookings ────────────────────────────────────────────

export async function createRecurringBooking(data: {
  salon_id: number;
  barber_id: number;
  customer_phone: string;
  customer_name?: string;
  service_id: number;
  appointment_time: string;
  end_time: string;
  frequency: 'weekly' | 'monthly';
  day_of_week?: number;
  day_of_month?: number;
}): Promise<{ success: boolean; id?: number; error?: string }> {
  let nextDate: string | null = null;
  if (data.frequency === 'weekly' && data.day_of_week) {
    nextDate = calcNextWeeklyDate(data.day_of_week);
  } else if (data.frequency === 'monthly' && data.day_of_month) {
    nextDate = calcNextMonthlyDate(data.day_of_month);
  }
  try {
    const res: any = await query(
      `INSERT INTO recurring_bookings 
       (salon_id, barber_id, customer_phone, customer_name, service_id, appointment_time, end_time, frequency, day_of_week, day_of_month, next_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.salon_id, data.barber_id, data.customer_phone, data.customer_name, data.service_id, data.appointment_time, data.end_time, data.frequency, data.day_of_week || null, data.day_of_month || null, nextDate]
    );
    return { success: true, id: res.insertId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getRecurringBookingsByPhone(phone: string): Promise<any[]> {
  const rows = await query(
    `SELECT rb.*, s.name as salon_name, sv.name as service_name, b.name as barber_name
     FROM recurring_bookings rb
     JOIN salons s ON rb.salon_id = s.id
     JOIN services sv ON rb.service_id = sv.id
     JOIN barbers b ON rb.barber_id = b.id
     WHERE rb.customer_phone = ? AND rb.status = 'active'
     ORDER BY rb.next_date ASC`,
    [phone]
  );
  return rows as any[];
}

export async function cancelRecurringBooking(id: number, phone: string): Promise<boolean> {
  const res: any = await query(
    "UPDATE recurring_bookings SET status = 'cancelled' WHERE id = ? AND customer_phone = ? AND status = 'active'",
    [id, phone]
  );
  return res.affectedRows > 0;
}

export async function getDueRecurringBookings(): Promise<any[]> {
  const today = new Date().toISOString().split('T')[0];
  const rows = await query(
    `SELECT rb.*, s.name as salon_name, sv.name as service_name, b.name as barber_name
     FROM recurring_bookings rb
     JOIN salons s ON rb.salon_id = s.id
     JOIN services sv ON rb.service_id = sv.id
     JOIN barbers b ON rb.barber_id = b.id
     WHERE rb.status = 'active' AND rb.next_date <= ? AND (rb.last_generated IS NULL OR rb.last_generated < rb.next_date)
     ORDER BY rb.next_date ASC`,
    [today]
  );
  return rows as any[];
}

export async function updateRecurringNextDate(id: number, nextDate: string | null, lastGenerated: string): Promise<void> {
  await query(
    'UPDATE recurring_bookings SET next_date = ?, last_generated = ? WHERE id = ?',
    [nextDate, lastGenerated, id]
  );
}

// ─── Automation Rule Functions ───────────────────────────────────

export interface AutomationRule {
  id: number;
  salon_id: number;
  trigger_type: string;
  action_type: string;
  action_config?: string;
  is_active: boolean;
  created_at: string;
  salon_name?: string;
}

export async function getAutomationRules(): Promise<AutomationRule[]> {
  const rows = await query(
    `SELECT a.*, s.name as salon_name FROM automations a
     LEFT JOIN salons s ON a.salon_id = s.id
     ORDER BY a.created_at DESC`
  );
  return rows as AutomationRule[];
}

export async function createAutomationRule(data: {
  salon_id: number;
  trigger_type: string;
  action_type: string;
  action_config?: string;
}): Promise<number> {
  const r: any = await query(
    'INSERT INTO automations (salon_id, trigger_type, action_type, action_config) VALUES (?, ?, ?, ?)',
    [data.salon_id, data.trigger_type, data.action_type, data.action_config || null]
  );
  return r.insertId;
}

export async function updateAutomationRule(id: number, data: {
  trigger_type?: string;
  action_type?: string;
  action_config?: string;
  is_active?: boolean;
}): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  if (data.trigger_type !== undefined) { sets.push('trigger_type = ?'); params.push(data.trigger_type); }
  if (data.action_type !== undefined) { sets.push('action_type = ?'); params.push(data.action_type); }
  if (data.action_config !== undefined) { sets.push('action_config = ?'); params.push(data.action_config); }
  if (data.is_active !== undefined) { sets.push('is_active = ?'); params.push(data.is_active ? 1 : 0); }
  if (sets.length === 0) return;
  params.push(id);
  await query(`UPDATE automations SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function deleteAutomationRule(id: number): Promise<void> {
  await query('DELETE FROM automations WHERE id = ?', [id]);
}

// ─── Helper: calculate next weekly date ──────────────────────────
function calcNextWeeklyDate(dayOfWeek: number): string {
  const now = new Date();
  const currentDay = now.getDay(); // 0=Sun, 1=Mon... 6=Sat
  let diff = dayOfWeek - currentDay;
  if (diff <= 0) diff += 7;
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  return next.toISOString().split('T')[0];
}

// ─── Helper: calculate next monthly date ─────────────────────────
function calcNextMonthlyDate(dayOfMonth: number): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const targetDay = Math.min(dayOfMonth, lastDay);
  const candidate = new Date(year, month, targetDay);
  if (candidate <= now) {
    // Next month
    const nextMonth = month + 1;
    const nextYear = nextMonth > 11 ? year + 1 : year;
    const nextMonthIndex = nextMonth > 11 ? 0 : nextMonth;
    const lastDayNext = new Date(nextYear, nextMonthIndex + 1, 0).getDate();
    const targetNext = Math.min(dayOfMonth, lastDayNext);
    return `${nextYear}-${String(nextMonthIndex + 1).padStart(2, '0')}-${String(targetNext).padStart(2, '0')}`;
  }
  return candidate.toISOString().split('T')[0];
}

// ─── Barber Attendance ────────────────────────────────────────────
export async function clockInBarber(barberId: number, salonId: number, pinCode: string, source: string = 'portal'): Promise<{ success: boolean; error?: string }> {
  const barber: any = await query('SELECT id, pin_code FROM barbers WHERE id = ? AND salon_id = ?', [barberId, salonId]);
  if (barber.length === 0) return { success: false, error: 'Barber not found' };
  if (!verifyPin(pinCode, barber[0].pin_code)) return { success: false, error: 'Invalid PIN' };
  const today = new Date().toISOString().split('T')[0];
  const existing: any = await query(
    "SELECT id FROM barber_attendance WHERE barber_id = ? AND date = ? AND status = 'clocked_in'",
    [barberId, today]
  );
  if (existing.length > 0) return { success: false, error: 'Already clocked in today' };
  const nowExpr = process.env.USE_SQLITE === 'true' ? "datetime('now')" : 'NOW()';
  await query(
    `INSERT INTO barber_attendance (barber_id, salon_id, date, clock_in, pin_code, source) VALUES (?, ?, ?, ${nowExpr}, ?, ?)`,
    [barberId, salonId, today, hashPin(pinCode), source]
  );
  return { success: true };
}

export async function clockOutBarber(barberId: number, salonId: number, pinCode: string): Promise<{ success: boolean; error?: string }> {
  const barber: any = await query('SELECT id, pin_code FROM barbers WHERE id = ? AND salon_id = ?', [barberId, salonId]);
  if (barber.length === 0) return { success: false, error: 'Barber not found' };
  if (!verifyPin(pinCode, barber[0].pin_code)) return { success: false, error: 'Invalid PIN' };
  const today = new Date().toISOString().split('T')[0];
  const existing: any = await query(
    "SELECT id FROM barber_attendance WHERE barber_id = ? AND date = ? AND status = 'clocked_in'",
    [barberId, today]
  );
  if (existing.length === 0) return { success: false, error: 'Not clocked in today' };
  const nowExpr = process.env.USE_SQLITE === 'true' ? "datetime('now')" : 'NOW()';
  await query(
    `UPDATE barber_attendance SET clock_out = ${nowExpr}, status = 'clocked_out' WHERE barber_id = ? AND date = ? AND status = 'clocked_in'`,
    [barberId, today]
  );
  return { success: true };
}

export async function getTodayAttendance(salonId: number): Promise<any[]> {
  const today = new Date().toISOString().split('T')[0];
  const rows = await query(
    `SELECT ba.*, b.name as barber_name
     FROM barber_attendance ba
     JOIN barbers b ON ba.barber_id = b.id
     WHERE ba.salon_id = ? AND ba.date = ?
     ORDER BY ba.clock_in DESC`,
    [salonId, today]
  );
  return rows as any[];
}

export async function getAttendanceHistory(salonId: number | null, days: number = 30): Promise<any[]> {
  const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
  const rows = salonId
    ? await query(
      `SELECT ba.*, b.name as barber_name
       FROM barber_attendance ba
       JOIN barbers b ON ba.barber_id = b.id
       WHERE ba.salon_id = ? AND ba.date >= ?
       ORDER BY ba.date DESC, ba.clock_in DESC`,
      [salonId, startDate]
    )
    : await query(
      `SELECT ba.*, b.name as barber_name
       FROM barber_attendance ba
       JOIN barbers b ON ba.barber_id = b.id
       WHERE ba.date >= ?
       ORDER BY ba.date DESC, ba.clock_in DESC`,
      [startDate]
    );
  return rows as any[];
}

export async function updateAttendance(id: number, data: { clock_in?: string; clock_out?: string; status?: string; date?: string }): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  if (data.clock_in !== undefined) { sets.push('clock_in = ?'); params.push(data.clock_in); }
  if (data.clock_out !== undefined) { sets.push('clock_out = ?'); params.push(data.clock_out); }
  if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
  if (data.date !== undefined) { sets.push('date = ?'); params.push(data.date); }
  if (sets.length === 0) return;
  params.push(id);
  await query(`UPDATE barber_attendance SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function deleteAttendance(id: number): Promise<void> {
  await query('DELETE FROM barber_attendance WHERE id = ?', [id]);
}

// ─── Walk-in Functions ────────────────────────────────────────────

export async function getWalkins(salonId: number): Promise<any[]> {
  const rows = await query(
    `SELECT a.*, s.name as service_name, b.name as barber_name
     FROM appointments a
     LEFT JOIN services s ON a.service_id = s.id
     LEFT JOIN barbers b ON a.barber_id = b.id
     WHERE a.salon_id = ?
     ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
    [salonId]
  );
  return rows as any[];
}

export async function updateWalkin(id: number, salonId: number, data: { customer_name?: string; customer_phone?: string; service_id?: number; barber_id?: number; appointment_date?: string; appointment_time?: string }): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  if (data.customer_name !== undefined) { sets.push('customer_name = ?'); params.push(data.customer_name); }
  if (data.customer_phone !== undefined) { sets.push('customer_phone = ?'); params.push(data.customer_phone); }
  if (data.service_id !== undefined) { sets.push('service_id = ?'); params.push(data.service_id); }
  if (data.barber_id !== undefined) { sets.push('barber_id = ?'); params.push(data.barber_id); }
  if (data.appointment_date !== undefined) { sets.push('appointment_date = ?'); params.push(data.appointment_date); }
  if (data.appointment_time !== undefined) { sets.push('appointment_time = ?'); params.push(data.appointment_time); }
  if (sets.length === 0) return;
  params.push(id, salonId);
  await query(`UPDATE appointments SET ${sets.join(', ')} WHERE id = ? AND salon_id = ?`, params);
}

export async function deleteWalkin(id: number, salonId: number): Promise<void> {
  await query('DELETE FROM appointments WHERE id = ? AND salon_id = ?', [id, salonId]);
}

// ─── Slot Finding Functions ────────────────────────────────────────────────

export async function findNextAvailableSlot(barberId: number, fromDate?: string, maxDays: number = 30): Promise<{ date: string; slot: { start: string; end: string } } | null> {
  const startDate = fromDate ? new Date(fromDate) : new Date();
  const todayStr = new Date().toISOString().split('T')[0];
  
  // First, get barber schedule days & day_offs in one query
  const barber: any[] = await query('SELECT salon_id FROM barbers WHERE id = ?', [barberId]);
  if (barber.length === 0) return null;
  const salonId = barber[0].salon_id;
  
  // Get all day_offs for next maxDays in one query
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + maxDays);
  const endStr = endDate.toISOString().split('T')[0];
  const dayOffs: any[] = await query(
    'SELECT date FROM day_offs WHERE salon_id = ? AND date >= ? AND date <= ? AND is_active = TRUE',
    [salonId, todayStr, endStr]
  );
  const dayOffSet = new Set(dayOffs.map((d: any) => d.date));
  
  // Get working days for barber
  const schedules: any[] = await query(
    'SELECT day_of_week, start_time, end_time, slot_duration, is_available FROM barber_schedule WHERE barber_id = ? AND is_available = 1',
    [barberId]
  );
  const workingDays = new Set(schedules.map((s: any) => s.day_of_week));
  if (workingDays.size === 0) return null;
  
  // Check each day but only call getAvailableSlots for potential candidates
  for (let i = 0; i < maxDays; i++) {
    const checkDate = new Date(startDate);
    checkDate.setDate(checkDate.getDate() + i);
    const dateStr = checkDate.toISOString().split('T')[0];
    if (dateStr < todayStr) continue;
    
    const dayOfWeek = checkDate.getDay();
    if (!workingDays.has(dayOfWeek)) continue;
    if (dayOffSet.has(dateStr)) continue;
    
    const slots = await getAvailableSlots(barberId, dateStr);
    if (slots.length > 0) {
      return { date: dateStr, slot: slots[0] };
    }
  }
  return null;
}

export async function findNextAvailableSlotForAnyBarber(salonId: number, serviceDuration: number, fromDate?: string, maxDays: number = 30): Promise<{ barberId: number; barberName: string; date: string; slot: { start: string; end: string } } | null> {
  const barbers = await getBarbersBySalon(salonId);
  const startDate = fromDate ? new Date(fromDate) : new Date();
  const todayStr = new Date().toISOString().split('T')[0];
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + maxDays);
  const endStr = endDate.toISOString().split('T')[0];
  
  // Get all day_offs in range once
  const dayOffs: any[] = await query(
    'SELECT date FROM day_offs WHERE salon_id = ? AND date >= ? AND date <= ? AND is_active = TRUE',
    [salonId, todayStr, endStr]
  );
  const dayOffSet = new Set(dayOffs.map((d: any) => d.date));
  
  // Get barber schedules for all active barbers
  const barberIds = barbers.filter((b: any) => b.status === 'active').map((b: any) => b.id);
  if (barberIds.length === 0) return null;
  
  const schedules: any[] = await query(
    `SELECT barber_id, day_of_week FROM barber_schedule WHERE barber_id IN (${barberIds.map(() => '?').join(',')}) AND is_available = 1`,
    barberIds
  );
  const scheduleMap = new Map<number, Set<number>>();
  for (const s of schedules) {
    if (!scheduleMap.has(s.barber_id)) scheduleMap.set(s.barber_id, new Set());
    scheduleMap.get(s.barber_id)!.add(s.day_of_week);
  }
  
  for (let i = 0; i < maxDays; i++) {
    const checkDate = new Date(startDate);
    checkDate.setDate(checkDate.getDate() + i);
    const dateStr = checkDate.toISOString().split('T')[0];
    if (dateStr < todayStr) continue;
    if (dayOffSet.has(dateStr)) continue;
    
    const dayOfWeek = checkDate.getDay();
    for (const barber of barbers) {
      if (barber.status !== 'active') continue;
      const days = scheduleMap.get(barber.id);
      if (!days || !days.has(dayOfWeek)) continue;
      
      const slots = await getAvailableSlots(barber.id, dateStr);
      if (slots.length > 0) {
        return { barberId: barber.id, barberName: barber.name, date: dateStr, slot: slots[0] };
      }
    }
  }
  return null;
}

export async function findRescheduleDates(barberId: number, fromDate: string, maxDays: number = 7): Promise<string[]> {
  const dates: string[] = [];
  const startDate = new Date(fromDate);
  const todayStr = new Date().toISOString().split('T')[0];
  
  for (let i = 0; i < maxDays; i++) {
    const checkDate = new Date(startDate);
    checkDate.setDate(checkDate.getDate() + i);
    const dateStr = checkDate.toISOString().split('T')[0];
    if (dateStr < todayStr) continue;
    
    const slots = await getAvailableSlots(barberId, dateStr);
    if (slots.length > 0) {
      dates.push(dateStr);
    }
  }
  return dates;
}

export async function updateAdmin2FA(id: number, code: string | null): Promise<void> {
  const hashed = code ? await bcrypt.hash(code, 10) : null;
  await query('UPDATE admins SET twofa_code = ?, twofa_enabled = ? WHERE id = ?', [hashed, code ? 1 : 0, id]);
}

export async function disableAdmin2FA(id: number): Promise<void> {
  await query("UPDATE admins SET twofa_enabled = FALSE, twofa_code = NULL WHERE id = ?", [id]);
}

export async function deleteSalonCascade(salonId: number): Promise<void> {
  await beginTransaction();
  try {
    await query('DELETE FROM appointments WHERE salon_id = ?', [salonId]);
    await query('DELETE FROM barber_schedule WHERE barber_id IN (SELECT id FROM barbers WHERE salon_id = ?)', [salonId]);
    await query('DELETE FROM barber_attendance WHERE salon_id = ?', [salonId]);
    await query('DELETE FROM barber_portfolio WHERE barber_id IN (SELECT id FROM barbers WHERE salon_id = ?)', [salonId]);
    await query('DELETE FROM barber_services WHERE barber_id IN (SELECT id FROM barbers WHERE salon_id = ?)', [salonId]);
    await query('DELETE FROM barbers WHERE salon_id = ?', [salonId]);
    await query('DELETE FROM services WHERE salon_id = ?', [salonId]);
    await query('DELETE FROM products WHERE salon_id = ?', [salonId]);
    await query('DELETE FROM staff WHERE salon_id = ?', [salonId]);
    await query('DELETE FROM seats WHERE salon_id = ?', [salonId]);
    await query('DELETE FROM expenses WHERE salon_id = ?', [salonId]);
    await query('DELETE FROM revenue WHERE salon_id = ?', [salonId]);
    await query('DELETE FROM reviews WHERE salon_id = ?', [salonId]);
    await query('DELETE FROM offers WHERE salon_id = ?', [salonId]);
    await query('DELETE FROM notification_logs WHERE salon_id = ?', [salonId]);
    await query('DELETE FROM notification_preferences WHERE salon_id = ?', [salonId]);
    await query('DELETE FROM working_hours WHERE salon_id = ?', [salonId]);
    await query('DELETE FROM shop_settings WHERE salon_id = ?', [salonId]);
    await query('DELETE FROM salaries WHERE salon_id = ?', [salonId]);
    await query('DELETE FROM salon_media WHERE salon_id = ?', [salonId]);
    await query('DELETE FROM salon_portfolio WHERE salon_id = ?', [salonId]);
    await query('DELETE FROM day_offs WHERE salon_id = ?', [salonId]);
    await query('DELETE FROM recurring_bookings WHERE salon_id = ?', [salonId]);
    await query('DELETE FROM broadcast_notifications WHERE salon_id = ?', [salonId]);
    await query('DELETE FROM disputes WHERE salon_id = ?', [salonId]);
    await query('DELETE FROM payouts WHERE salon_id = ?', [salonId]);
    await query('DELETE FROM automations WHERE salon_id = ?', [salonId]);
    await commit();
  } catch (err) {
    await rollback().catch(() => {});
    throw err;
  }
}

export async function recordCustomerVisit(phone: string): Promise<void> {
  const cleanPhone = phone.replace('@s.whatsapp.net', '');
  if (process.env.USE_SQLITE === 'true') {
    await query(
      `INSERT INTO customers (phone, name, total_visits, last_status, last_active)
       VALUES (?, ?, 1, 'New', datetime('now'))
       ON CONFLICT(phone) DO UPDATE SET 
         total_visits = COALESCE(total_visits, 0) + 1, 
         last_active = datetime('now')`,
      [cleanPhone, cleanPhone]
    );
  } else {
    await query(
      `INSERT INTO customers (phone, name, total_visits, last_status, last_active)
       VALUES (?, ?, 1, 'New', NOW())
       ON DUPLICATE KEY UPDATE 
         total_visits = COALESCE(total_visits, 0) + 1, 
         last_active = NOW()`,
      [cleanPhone, cleanPhone]
    );
  }
  const rows: any = await query('SELECT total_visits FROM customers WHERE phone = ?', [cleanPhone]);
  if (rows.length > 0) {
    const visits = rows[0].total_visits;
    let newStatus = 'New';
    if (visits >= 10) newStatus = 'Elite';
    else if (visits >= 6) newStatus = 'VIP';
    else if (visits >= 3) newStatus = 'Regular';
    await query('UPDATE customers SET last_status = ? WHERE phone = ?', [newStatus, cleanPhone]);
  }
}
