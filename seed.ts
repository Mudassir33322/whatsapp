import Database from 'better-sqlite3';
import path from 'path';
import { hashSync } from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

// Safety: Never run seed in production
if (process.env.NODE_ENV === 'production') {
  console.error('[SEED] CRITICAL: Refusing to run seed in production environment!');
  process.exit(1);
}

const dataDir = process.env.DATA_DIR || process.cwd();
const dbPath = process.env.DB_PATH || path.join(dataDir, 'autozap_dev.sqlite');
console.log(`[Seed] Using database: ${dbPath}`);

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// ── Create all tables if they don't exist ──
db.exec(`CREATE TABLE IF NOT EXISTS countries (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone_code TEXT, is_active INTEGER DEFAULT 1)`);
db.exec(`CREATE TABLE IF NOT EXISTS cities (id INTEGER PRIMARY KEY AUTOINCREMENT, country_id INTEGER NOT NULL, name TEXT NOT NULL, is_active INTEGER DEFAULT 1, FOREIGN KEY (country_id) REFERENCES countries(id))`);
db.exec(`CREATE TABLE IF NOT EXISTS areas (id INTEGER PRIMARY KEY AUTOINCREMENT, city_id INTEGER NOT NULL, name TEXT NOT NULL, is_active INTEGER DEFAULT 1, FOREIGN KEY (city_id) REFERENCES cities(id))`);
db.exec(`CREATE TABLE IF NOT EXISTS salons (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, owner_name TEXT, phone TEXT UNIQUE, email TEXT UNIQUE, password TEXT, owner_phone TEXT, country_id INTEGER, city_id INTEGER, area_id INTEGER, address TEXT, cover_image_url TEXT, logo_url TEXT, description TEXT, status TEXT DEFAULT 'pending', rating REAL DEFAULT 0, review_count INTEGER DEFAULT 0, assigned_admin_id INTEGER, latitude REAL, longitude REAL, commission_rate REAL DEFAULT 0, commission_type TEXT DEFAULT 'percentage', created_at TEXT DEFAULT (datetime('now')))`);
db.exec(`CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT DEFAULT 'admin', is_active INTEGER DEFAULT 1, twofa_enabled INTEGER DEFAULT 0, twofa_code TEXT, last_login TEXT, created_at TEXT, updated_at TEXT)`);
db.exec(`CREATE TABLE IF NOT EXISTS barbers (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, name TEXT NOT NULL, phone TEXT, email TEXT, bio TEXT, experience INTEGER DEFAULT 0, specialization TEXT, profile_image TEXT, rating REAL DEFAULT 0, review_count INTEGER DEFAULT 0, status TEXT DEFAULT 'active', pin_code TEXT, created_at TEXT, FOREIGN KEY (salon_id) REFERENCES salons(id))`);
db.exec(`CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, name TEXT NOT NULL, description TEXT, price REAL NOT NULL, duration INTEGER NOT NULL, category TEXT, is_active INTEGER DEFAULT 1, created_at TEXT, FOREIGN KEY (salon_id) REFERENCES salons(id))`);
db.exec(`CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, barber_id INTEGER, customer_phone TEXT NOT NULL, customer_name TEXT, service_id INTEGER NOT NULL, appointment_date TEXT NOT NULL, appointment_time TEXT NOT NULL, end_time TEXT, status TEXT DEFAULT 'pending', token TEXT UNIQUE, notes TEXT, created_at TEXT, FOREIGN KEY (salon_id) REFERENCES salons(id), FOREIGN KEY (barber_id) REFERENCES barbers(id), FOREIGN KEY (service_id) REFERENCES services(id))`);
db.exec(`CREATE TABLE IF NOT EXISTS customers (phone TEXT PRIMARY KEY, name TEXT, global_points INTEGER DEFAULT 0, loyalty_points INTEGER DEFAULT 0, total_visits INTEGER DEFAULT 0, referral_code TEXT, status TEXT DEFAULT 'New', last_status TEXT DEFAULT 'New', last_active TEXT, created_at TEXT, updated_at TEXT)`);
db.exec(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, phone TEXT NOT NULL, push_name TEXT, text TEXT NOT NULL, from_me INTEGER DEFAULT 0, timestamp TEXT)`);
db.exec(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, name TEXT NOT NULL, price REAL NOT NULL, stock INTEGER DEFAULT 0, min_stock INTEGER DEFAULT 0, unit TEXT DEFAULT 'piece', is_active INTEGER DEFAULT 1, created_at TEXT, FOREIGN KEY (salon_id) REFERENCES salons(id))`);
db.exec(`CREATE TABLE IF NOT EXISTS barber_schedule (id INTEGER PRIMARY KEY AUTOINCREMENT, barber_id INTEGER NOT NULL, day_of_week INTEGER NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, slot_duration INTEGER DEFAULT 30, is_available INTEGER DEFAULT 1, FOREIGN KEY (barber_id) REFERENCES barbers(id))`);
db.exec(`CREATE TABLE IF NOT EXISTS recurring_bookings (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, barber_id INTEGER NOT NULL, customer_phone TEXT NOT NULL, customer_name TEXT, service_id INTEGER NOT NULL, appointment_time TEXT NOT NULL, end_time TEXT NOT NULL, frequency TEXT, day_of_week INTEGER, day_of_month INTEGER, status TEXT DEFAULT 'active', last_generated TEXT, next_date TEXT, created_at TEXT, FOREIGN KEY (salon_id) REFERENCES salons(id))`);
db.exec(`CREATE TABLE IF NOT EXISTS notification_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER, notification_type TEXT, customer_phone TEXT, message_sent TEXT, sent_at TEXT)`);
db.exec(`CREATE TABLE IF NOT EXISTS staff (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, name TEXT NOT NULL, role TEXT, salary_type TEXT, base_salary REAL, commission_rate REAL, phone TEXT, created_at TEXT, FOREIGN KEY (salon_id) REFERENCES salons(id))`);
db.exec(`CREATE TABLE IF NOT EXISTS seats (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, name TEXT NOT NULL, status TEXT DEFAULT 'Available', assigned_staff_id INTEGER, created_at TEXT, FOREIGN KEY (salon_id) REFERENCES salons(id))`);
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
db.exec(`CREATE TABLE IF NOT EXISTS payouts (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, barber_id INTEGER, amount REAL, status TEXT DEFAULT 'pending', period_start TEXT, period_end TEXT, processed_at TEXT, processed_by INTEGER, admin_notes TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (salon_id) REFERENCES salons(id))`);
db.exec(`CREATE TABLE IF NOT EXISTS disputes (id INTEGER PRIMARY KEY AUTOINCREMENT, salon_id INTEGER NOT NULL, customer_phone TEXT, appointment_id INTEGER, reason TEXT, status TEXT DEFAULT 'open', resolution TEXT, resolved_by INTEGER, resolved_at TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (salon_id) REFERENCES salons(id))`);
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

function countRows(table: string): number {
  return (db.prepare(`SELECT COUNT(*) as c FROM [${table}]`).get() as any).c;
}

function seed() {
  // ── Ensure base tables have data ──
  if (countRows('countries') === 0) {
    db.prepare("INSERT INTO countries (id, name, phone_code, is_active) VALUES (1, 'Pakistan', '+92', 1)").run();
    console.log('[Seed] country inserted');
  }
  if (countRows('cities') === 0) {
    db.prepare("INSERT INTO cities (id, country_id, name, is_active) VALUES (1, 1, 'Karachi', 1)").run();
    console.log('[Seed] city inserted');
  }
  if (countRows('areas') === 0) {
    db.prepare("INSERT INTO areas (id, city_id, name, is_active) VALUES (1, 1, 'Clifton', 1)").run();
    console.log('[Seed] area inserted');
  }
  if (countRows('salons') === 0) {
    const hash = hashSync('admin123', 10);
    db.prepare(`INSERT INTO salons (id, name, owner_name, phone, email, password, country_id, city_id, area_id, address, description, status)
      VALUES (1, 'Prime Cuts Studio', 'Ali Khan', '0300-1111111', 'primecuts@salon.com', ?, 1, 1, 1, '123 Main Street, Downtown', 'Premium salon offering haircuts, styling, and grooming services.', 'active')`).run(hash);
    console.log('[Seed] salon inserted (primecuts@salon.com / admin123)');
  }
if (countRows('admins') === 0) {
     const hash = hashSync('admin123', 10);
     // Super Admin
     db.prepare("INSERT INTO admins (id, name, email, password, role, is_active) VALUES (1, 'Super Admin', 'admin@autozap.com', ?, 'super_admin', 1)").run(hash);
     // Regular Admin
     db.prepare("INSERT INTO admins (id, name, email, password, role, is_active) VALUES (2, 'Ali Admin', 'ali.admin@autozap.com', ?, 'admin', 1)").run(hash);
     // Support Admin
     db.prepare("INSERT INTO admins (id, name, email, password, role, is_active) VALUES (3, 'Sana Support', 'sana.support@autozap.com', ?, 'support', 1)").run(hash);
     // Viewer Admin
     db.prepare("INSERT INTO admins (id, name, email, password, role, is_active) VALUES (4, 'Viewer Only', 'viewer@autozap.com', ?, 'viewer', 1)").run(hash);
     console.log('[Seed] 4 admins inserted (super_admin, admin, support, viewer)');
   }
  if (countRows('barbers') === 0) {
    db.prepare(`INSERT INTO barbers (id, salon_id, name, phone, experience, specialization, rating, review_count, status, bio)
      VALUES (1, 1, 'Usman', '0301-1111111', 8, 'Haircuts & Styling', 4.8, 120, 'active', 'Expert barber with 8 years of experience')`).run();
    db.prepare(`INSERT INTO barbers (id, salon_id, name, phone, experience, specialization, rating, review_count, status, bio)
      VALUES (2, 1, 'Ahmed', '0301-1111112', 5, 'Beard & Grooming', 4.6, 85, 'active', 'Specialist in beard styling')`).run();
    db.prepare(`INSERT INTO barbers (id, salon_id, name, phone, experience, specialization, rating, review_count, status, bio)
      VALUES (3, 1, 'Bilal', '0301-1111113', 6, 'Color & Highlights', 4.7, 98, 'active', 'Color specialist')`).run();
    db.prepare(`INSERT INTO barbers (id, salon_id, name, phone, experience, specialization, rating, review_count, status, bio)
      VALUES (4, 1, 'Farhan', '0301-1111114', 10, 'Traditional & Party Cuts', 4.9, 200, 'active', 'Master barber for traditional cuts')`).run();
    console.log('[Seed] 4 barbers inserted');
  }
  if (countRows('barber_schedule') === 0) {
    const barberScheduleData = [
      // Barber 1 (Usman): All days 9AM-10PM
      ...Array.from({length: 7}, (_, day) => [1, day, '09:00', '22:00', 30, 1]),
      // Barber 2 (Ahmed): Mon-Sat 10AM-9PM, Sun off
      ...Array.from({length: 6}, (_, day) => [2, day+1, '10:00', '21:00', 30, 1]),
      [2, 0, '10:00', '17:00', 30, 0],  // Sun off
      // Barber 3 (Bilal): All days 10AM-8PM
      ...Array.from({length: 7}, (_, day) => [3, day, '10:00', '20:00', 30, 1]),
      // Barber 4 (Farhan): Mon-Sat 9AM-11PM, Sun half day
      ...Array.from({length: 6}, (_, day) => [4, day+1, '09:00', '23:00', 30, 1]),
      [4, 0, '10:00', '18:00', 30, 1],  // Sun half day
    ];
    const stmt = db.prepare('INSERT INTO barber_schedule (barber_id, day_of_week, start_time, end_time, slot_duration, is_available) VALUES (?, ?, ?, ?, ?, ?)');
    for (const row of barberScheduleData) { stmt.run(...row); }
    console.log('[Seed] barber_schedule inserted (28 entries)');
  }
  if (countRows('services') === 0) {
    db.prepare("INSERT INTO services (id, salon_id, name, description, price, duration, category) VALUES (1, 1, 'Haircut', 'Classic haircut', 500, 30, 'Hair')").run();
    db.prepare("INSERT INTO services (id, salon_id, name, description, price, duration, category) VALUES (2, 1, 'Beard Trim', 'Professional beard shaping', 300, 20, 'Beard')").run();
    db.prepare("INSERT INTO services (id, salon_id, name, description, price, duration, category) VALUES (3, 1, 'Haircut + Beard', 'Full combo', 700, 45, 'Combo')").run();
    db.prepare("INSERT INTO services (id, salon_id, name, description, price, duration, category) VALUES (4, 1, 'Hair Color', 'Professional coloring', 1500, 60, 'Color')").run();
    db.prepare("INSERT INTO services (id, salon_id, name, description, price, duration, category) VALUES (5, 1, 'Party Styling', 'Special event styling', 1000, 45, 'Styling')").run();
    console.log('[Seed] 5 services inserted');
  }

  // ── customers ──
  if (countRows('customers') === 0) {
    db.prepare(`INSERT INTO customers (phone, name, global_points, loyalty_points, total_visits, referral_code, status, last_status, last_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-1 hour'))`).run('+923001234561', 'Ahmed Raza', 150, 50, 12, 'AR2026', 'Regular', 'Regular');
    db.prepare(`INSERT INTO customers (phone, name, global_points, loyalty_points, total_visits, referral_code, status, last_status, last_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-3 days'))`).run('+923001234562', 'Sara Khan', 80, 20, 5, 'SK2026', 'Regular', 'Regular');
    db.prepare(`INSERT INTO customers (phone, name, global_points, loyalty_points, total_visits, referral_code, status, last_status, last_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-7 days'))`).run('+923001234563', 'Usman Ali', 30, 10, 2, 'UA2026', 'New', 'New');
    db.prepare(`INSERT INTO customers (phone, name, global_points, loyalty_points, total_visits, referral_code, status, last_status, last_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-1 day'))`).run('+923001234564', 'Fatima Noor', 200, 80, 20, 'FN2026', 'VIP', 'VIP');
    db.prepare(`INSERT INTO customers (phone, name, global_points, loyalty_points, total_visits, referral_code, status, last_status, last_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run('+923001234565', 'Bilal Hussain', 0, 0, 0, '', 'New', 'New');
    console.log('[Seed] customers inserted');
  }

  // ── appointments ──
  if (countRows('appointments') === 0) {
    db.prepare(`INSERT INTO appointments (salon_id, barber_id, customer_phone, customer_name, service_id, appointment_date, appointment_time, end_time, status, token, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(1, 1, '+923001234561', 'Ahmed Raza', 1, '2026-06-27', '10:00', '10:30', 'confirmed', 'TKN001', 'Please use premium products');
    db.prepare(`INSERT INTO appointments (salon_id, barber_id, customer_phone, customer_name, service_id, appointment_date, appointment_time, end_time, status, token, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(1, 2, '+923001234562', 'Sara Khan', 2, '2026-06-27', '11:00', '11:20', 'confirmed', 'TKN002', null);
    db.prepare(`INSERT INTO appointments (salon_id, barber_id, customer_phone, customer_name, service_id, appointment_date, appointment_time, end_time, status, token, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(1, 3, '+923001234563', 'Usman Ali', 4, '2026-06-27', '14:00', '14:20', 'pending', 'TKN003', null);
    db.prepare(`INSERT INTO appointments (salon_id, barber_id, customer_phone, customer_name, service_id, appointment_date, appointment_time, end_time, status, token, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(1, 4, '+923001234564', 'Fatima Noor', 3, '2026-06-28', '09:00', '09:45', 'pending', 'TKN004', 'Birthday celebration');
    db.prepare(`INSERT INTO appointments (salon_id, barber_id, customer_phone, customer_name, service_id, appointment_date, appointment_time, end_time, status, token, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(1, 1, '+923001234561', 'Ahmed Raza', 5, '2026-06-20', '15:00', '16:00', 'completed', 'TKN005', null);
    db.prepare(`INSERT INTO appointments (salon_id, barber_id, customer_phone, customer_name, service_id, appointment_date, appointment_time, end_time, status, token, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(1, 2, '+923001234562', 'Sara Khan', 1, '2026-06-19', '16:00', '16:30', 'cancelled', 'TKN006', 'Emergency');
    console.log('[Seed] appointments inserted');
  }

  // ── products ──
  if (countRows('products') === 0) {
    db.prepare('INSERT INTO products (salon_id, name, price, stock, min_stock, unit) VALUES (?, ?, ?, ?, ?, ?)').run(1, 'Hair Wax', 450, 20, 5, 'piece');
    db.prepare('INSERT INTO products (salon_id, name, price, stock, min_stock, unit) VALUES (?, ?, ?, ?, ?, ?)').run(1, 'Beard Oil', 350, 15, 3, 'bottle');
    db.prepare('INSERT INTO products (salon_id, name, price, stock, min_stock, unit) VALUES (?, ?, ?, ?, ?, ?)').run(1, 'Shampoo 250ml', 500, 12, 5, 'bottle');
    db.prepare('INSERT INTO products (salon_id, name, price, stock, min_stock, unit) VALUES (?, ?, ?, ?, ?, ?)').run(1, 'Conditioner 250ml', 550, 8, 4, 'bottle');
    db.prepare('INSERT INTO products (salon_id, name, price, stock, min_stock, unit) VALUES (?, ?, ?, ?, ?, ?)').run(1, 'Hair Gel', 250, 30, 10, 'piece');
    db.prepare('INSERT INTO products (salon_id, name, price, stock, min_stock, unit) VALUES (?, ?, ?, ?, ?, ?)').run(1, 'Face Wash', 300, 10, 3, 'piece');
    console.log('[Seed] products inserted');
  }

  // ── staff ──
  if (countRows('staff') === 0) {
    db.prepare('INSERT INTO staff (salon_id, name, role, salary_type, base_salary, commission_rate, phone) VALUES (?, ?, ?, ?, ?, ?, ?)').run(1, 'Ahmed Ali', 'Master Barber', 'fixed', 45000, 15, '0300-1112244');
    db.prepare('INSERT INTO staff (salon_id, name, role, salary_type, base_salary, commission_rate, phone) VALUES (?, ?, ?, ?, ?, ?, ?)').run(1, 'Zubair Khan', 'Junior Barber', 'fixed', 25000, 10, '0300-1112255');
    db.prepare('INSERT INTO staff (salon_id, name, role, salary_type, base_salary, commission_rate, phone) VALUES (?, ?, ?, ?, ?, ?, ?)').run(1, 'Imran Ali', 'Receptionist', 'fixed', 20000, 0, '0300-1112266');
    console.log('[Seed] staff inserted');
  }

  // ── seats ──
  if (countRows('seats') === 0) {
    db.prepare('INSERT INTO seats (salon_id, name, status, assigned_staff_id) VALUES (?, ?, ?, ?)').run(1, 'Seat 1', 'Occupied', 1);
    db.prepare('INSERT INTO seats (salon_id, name, status, assigned_staff_id) VALUES (?, ?, ?, ?)').run(1, 'Seat 2', 'Occupied', 2);
    db.prepare('INSERT INTO seats (salon_id, name, status, assigned_staff_id) VALUES (?, ?, ?, ?)').run(1, 'Seat 3', 'Available', null);
    db.prepare('INSERT INTO seats (salon_id, name, status, assigned_staff_id) VALUES (?, ?, ?, ?)').run(1, 'Seat 4', 'Available', null);
    db.prepare('INSERT INTO seats (salon_id, name, status, assigned_staff_id) VALUES (?, ?, ?, ?)').run(1, 'Seat 5', 'Occupied', 3);
    console.log('[Seed] seats inserted');
  }

  // ── working_hours ──
  if (countRows('working_hours') === 0) {
    const days = [
      [0, '09:00', '22:00', 1], [1, '09:00', '23:00', 1], [2, '09:00', '23:00', 1],
      [3, '09:00', '23:00', 1], [4, '09:00', '23:00', 1], [5, '09:00', '23:00', 1],
      [6, '10:00', '23:00', 1]
    ];
    for (const [day, start, end, open] of days) {
      db.prepare('INSERT INTO working_hours (salon_id, day, start_time, end_time, is_open) VALUES (?, ?, ?, ?, ?)').run(1, day, start, end, open);
    }
    console.log('[Seed] working_hours inserted');
  }

  // ── shop_settings ──
  if (countRows('shop_settings') === 0) {
    db.prepare('INSERT INTO shop_settings (salon_id, company_name, currency, language, address, map_url) VALUES (?, ?, ?, ?, ?, ?)').run(1, 'Prime Cuts Studio', 'Rs.', 'Urdu/English', '123 Main Street, Downtown', 'https://maps.google.com/?q=prime+cuts');
    console.log('[Seed] shop_settings inserted');
  }

  // ── notification_preferences ──
  if (countRows('notification_preferences') === 0) {
    db.prepare('INSERT INTO notification_preferences (salon_id, reminder_30min, queue_update, review_request, re_engagement) VALUES (?, 1, 1, 1, 1)').run(1);
    console.log('[Seed] notification_preferences inserted');
  }

  // ── notification_logs ──
  if (countRows('notification_logs') === 0) {
    db.prepare(`INSERT INTO notification_logs (salon_id, notification_type, customer_phone, message_sent, sent_at)
      VALUES (?, ?, ?, ?, datetime('now', '-1 day'))`).run(1, 'appointment_reminder', '+923001234561', 'Reminder: Aap ka appointment 10:00 AM par hai. - Prime Cuts');
    db.prepare(`INSERT INTO notification_logs (salon_id, notification_type, customer_phone, message_sent, sent_at)
      VALUES (?, ?, ?, ?, datetime('now', '-2 days'))`).run(1, 'queue_update', '+923001234562', 'Your turn is approaching. Please be ready.');
    db.prepare(`INSERT INTO notification_logs (salon_id, notification_type, customer_phone, message_sent, sent_at)
      VALUES (?, ?, ?, ?, datetime('now', '-5 days'))`).run(1, 'review_request', '+923001234564', 'How was your experience? Share a review!');
    db.prepare(`INSERT INTO notification_logs (salon_id, notification_type, customer_phone, message_sent, sent_at)
      VALUES (?, ?, ?, ?, datetime('now', '-1 hour'))`).run(1, 'generic', '+923001234563', 'Welcome to Prime Cuts! Book your appointment today.');
    console.log('[Seed] notification_logs inserted');
  }

  // ── expenses ──
  if (countRows('expenses') === 0) {
    db.prepare("INSERT INTO expenses (salon_id, description, amount, category, date) VALUES (?, ?, ?, ?, date('now'))").run(1, 'Electricity Bill', 8500, 'Utilities');
    db.prepare("INSERT INTO expenses (salon_id, description, amount, category, date) VALUES (?, ?, ?, ?, date('now', '-3 days'))").run(1, 'Products Restock', 12000, 'Inventory');
    db.prepare("INSERT INTO expenses (salon_id, description, amount, category, date) VALUES (?, ?, ?, ?, date('now', '-7 days'))").run(1, 'Water Supply', 2000, 'Utilities');
    db.prepare("INSERT INTO expenses (salon_id, description, amount, category, date) VALUES (?, ?, ?, ?, date('now', '-14 days'))").run(1, 'Chair Repair', 3500, 'Maintenance');
    console.log('[Seed] expenses inserted');
  }

  // ── revenue ──
  if (countRows('revenue') === 0) {
    db.prepare("INSERT INTO revenue (salon_id, amount, date) VALUES (?, ?, date('now'))").run(1, 5000);
    db.prepare("INSERT INTO revenue (salon_id, amount, date) VALUES (?, ?, date('now', '-1 day'))").run(1, 7200);
    db.prepare("INSERT INTO revenue (salon_id, amount, date) VALUES (?, ?, date('now', '-2 days'))").run(1, 3800);
    db.prepare("INSERT INTO revenue (salon_id, amount, date) VALUES (?, ?, date('now', '-3 days'))").run(1, 6100);
    console.log('[Seed] revenue inserted');
  }

  // ── salaries (FK: staff_id) ──
  if (countRows('salaries') === 0) {
    db.prepare("INSERT INTO salaries (salon_id, staff_id, amount, type, status, date) VALUES (?, ?, ?, 'monthly', 'Paid', date('now', 'start of month'))").run(1, 1, 45000);
    db.prepare("INSERT INTO salaries (salon_id, staff_id, amount, type, status, date) VALUES (?, ?, ?, 'monthly', 'Paid', date('now', 'start of month'))").run(1, 2, 25000);
    db.prepare("INSERT INTO salaries (salon_id, staff_id, amount, type, status, date) VALUES (?, ?, ?, 'monthly', 'Paid', date('now', 'start of month'))").run(1, 3, 20000);
    console.log('[Seed] salaries inserted');
  }

  // ── messages ──
  if (countRows('messages') === 0) {
    db.prepare(`INSERT INTO messages (session_id, phone, push_name, text, from_me, timestamp) VALUES (?, ?, ?, ?, ?, datetime('now', '-1 hour'))`).run('autozap-admin', '+923001234561', 'Ahmed Raza', 'Hello, I want to book a haircut', 0);
    db.prepare(`INSERT INTO messages (session_id, phone, push_name, text, from_me, timestamp) VALUES (?, ?, ?, ?, ?, datetime('now', '-1 hour'))`).run('autozap-admin', '+923001234561', null, 'Sure! Available at 10:00 AM today.', 1);
    db.prepare(`INSERT INTO messages (session_id, phone, push_name, text, from_me, timestamp) VALUES (?, ?, ?, ?, ?, datetime('now', '-2 hours'))`).run('autozap-admin', '+923001234562', 'Sara Khan', 'What are your rates for beard trim?', 0);
    db.prepare(`INSERT INTO messages (session_id, phone, push_name, text, from_me, timestamp) VALUES (?, ?, ?, ?, ?, datetime('now', '-2 hours'))`).run('autozap-admin', '+923001234562', null, 'Beard trim is Rs. 150 only!', 1);
    db.prepare(`INSERT INTO messages (session_id, phone, push_name, text, from_me, timestamp) VALUES (?, ?, ?, ?, ?, datetime('now', '-1 day'))`).run('autozap-admin', '+923001234564', 'Fatima Noor', 'Can I book for two people?', 0);
    console.log('[Seed] messages inserted');
  }

  // ── reviews ──
  if (countRows('reviews') === 0) {
    db.prepare("INSERT INTO reviews (salon_id, barber_id, customer_phone, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', '-10 days'))").run(1, 1, '+923001234561', 5, 'Excellent haircut! Ali bhai ne bohat acha kiya.');
    db.prepare("INSERT INTO reviews (salon_id, barber_id, customer_phone, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', '-5 days'))").run(1, 2, '+923001234562', 4, 'Good service, but waiting time zyada tha.');
    db.prepare("INSERT INTO reviews (salon_id, barber_id, customer_phone, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', '-2 days'))").run(1, 4, '+923001234564', 5, 'Best salon in town! Highly recommend.');
    console.log('[Seed] reviews inserted');
  }

  // ── barber_services ──
  if (countRows('barber_services') === 0) {
    for (let sid = 1; sid <= 5; sid++) {
      db.prepare('INSERT INTO barber_services (barber_id, service_id) VALUES (?, ?)').run(1, sid);
    }
    for (const sid of [1, 2, 3, 4]) {
      db.prepare('INSERT INTO barber_services (barber_id, service_id) VALUES (?, ?)').run(2, sid);
    }
    for (const sid of [3, 4, 5]) {
      db.prepare('INSERT INTO barber_services (barber_id, service_id) VALUES (?, ?)').run(3, sid);
    }
    for (const sid of [1, 2, 3]) {
      db.prepare('INSERT INTO barber_services (barber_id, service_id) VALUES (?, ?)').run(4, sid);
    }
    console.log('[Seed] barber_services inserted');
  }

  // ── platform_settings ──
  if (countRows('platform_settings') === 0) {
    db.prepare("INSERT INTO platform_settings (setting_key, setting_value, setting_type, description) VALUES (?, ?, ?, ?)").run('platform_name', 'AutoZap Enterprise', 'string', 'Name of the platform');
    db.prepare("INSERT INTO platform_settings (setting_key, setting_value, setting_type, description) VALUES (?, ?, ?, ?)").run('commission_rate_default', '10', 'number', 'Default commission rate for new salons');
    db.prepare("INSERT INTO platform_settings (setting_key, setting_value, setting_type, description) VALUES (?, ?, ?, ?)").run('maintenance_mode', 'false', 'boolean', 'Enable maintenance mode');
    db.prepare("INSERT INTO platform_settings (setting_key, setting_value, setting_type, description) VALUES (?, ?, ?, ?)").run('currency', 'Rs.', 'string', 'Default currency');
    console.log('[Seed] platform_settings inserted');
  }

  // ── coupons ──
  if (countRows('coupons') === 0) {
    db.prepare("INSERT INTO coupons (code, type, value, min_amount, max_uses, used_count, valid_from, valid_until, is_active, created_by) VALUES (?, 'percentage', ?, ?, ?, 0, date('now'), date('now', '+30 days'), 1, 1)").run('WELCOME20', 20, 500, 100);
    db.prepare("INSERT INTO coupons (code, type, value, min_amount, max_uses, used_count, valid_from, valid_until, is_active, created_by) VALUES (?, 'flat', ?, ?, ?, 5, date('now'), date('now', '+15 days'), 1, 1)").run('HAIRCUT50', 50, 200, 50);
    db.prepare("INSERT INTO coupons (code, type, value, min_amount, max_uses, used_count, valid_from, valid_until, is_active, created_by) VALUES (?, 'percentage', ?, ?, ?, 50, date('now', '-10 days'), date('now', '+20 days'), 1, 1)").run('SUMMER15', 15, 300, 200);
    console.log('[Seed] coupons inserted');
  }

  // ── templates ──
  if (countRows('templates') === 0) {
    db.prepare("INSERT INTO templates (name, type, subject, body, variables, is_active, updated_by) VALUES (?, ?, ?, ?, ?, 1, 1)").run(
      'appointment_reminder', 'whatsapp', 'Appointment Reminder',
      'Dear {customer_name}, aap ka appointment {appointment_date} ko {appointment_time} par hai. - {salon_name}',
      '["customer_name","appointment_date","appointment_time","salon_name"]'
    );
    db.prepare("INSERT INTO templates (name, type, subject, body, variables, is_active, updated_by) VALUES (?, ?, ?, ?, ?, 1, 1)").run(
      'welcome_message', 'whatsapp', 'Welcome',
      'Welcome to {salon_name}! Book your first appointment and get 20% off.',
      '["salon_name"]'
    );
    db.prepare("INSERT INTO templates (name, type, subject, body, variables, is_active, updated_by) VALUES (?, ?, ?, ?, ?, 1, 1)").run(
      'review_request', 'whatsapp', 'Review Request',
      'How was your experience at {salon_name}? Share your feedback!',
      '["salon_name"]'
    );
    console.log('[Seed] templates inserted');
  }

  // ── broadcast_notifications ──
  if (countRows('broadcast_notifications') === 0) {
    db.prepare("INSERT INTO broadcast_notifications (salon_id, title, message, target, status, sent_at) VALUES (?, ?, ?, 'all', 'sent', date('now', '-5 days'))").run(1, 'Summer Sale!', '20% off on all services this summer! Book now.');
    db.prepare("INSERT INTO broadcast_notifications (salon_id, title, message, target, status, scheduled_at) VALUES (?, ?, ?, 'regular_customers', 'scheduled', date('now', '+7 days'))").run(1, 'Weekend Offer', 'Special weekend discount for regular customers!');
    console.log('[Seed] broadcast_notifications inserted');
  }

  // ── whatsapp_sessions ──
  if (countRows('whatsapp_sessions') === 0) {
    db.prepare("INSERT INTO whatsapp_sessions (session_id, name, status) VALUES (?, ?, 'disconnected')").run('autozap-admin', 'Main WhatsApp');
    console.log('[Seed] whatsapp_sessions inserted');
  }

  // ── barber_attendance ──
  if (countRows('barber_attendance') === 0) {
    db.prepare("INSERT INTO barber_attendance (barber_id, salon_id, date, clock_in, clock_out, status) VALUES (?, ?, date('now'), '09:00', '18:00', 'clocked_out')").run(1, 1);
    db.prepare("INSERT INTO barber_attendance (barber_id, salon_id, date, clock_in, clock_out, status) VALUES (?, ?, date('now'), '09:30', '17:30', 'clocked_out')").run(2, 1);
    db.prepare("INSERT INTO barber_attendance (barber_id, salon_id, date, clock_in, clock_out, status) VALUES (?, ?, date('now', '-1 day'), '09:00', '18:00', 'clocked_out')").run(1, 1);
    console.log('[Seed] barber_attendance inserted');
  }

  // ── customer_tags ──
  if (countRows('customer_tags') === 0) {
    db.prepare("INSERT INTO customer_tags (customer_phone, tag) VALUES (?, ?)").run('+923001234561', 'VIP');
    db.prepare("INSERT INTO customer_tags (customer_phone, tag) VALUES (?, ?)").run('+923001234562', 'Regular');
    db.prepare("INSERT INTO customer_tags (customer_phone, tag) VALUES (?, ?)").run('+923001234564', 'Premium');
    console.log('[Seed] customer_tags inserted');
  }

  // ── audit_logs ──
  if (countRows('audit_logs') === 0) {
    db.prepare("INSERT INTO audit_logs (admin_id, admin_email, action, entity_type, entity_id, details, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-1 day'))").run(1, 'admin@autozap.com', 'LOGIN', 'admin', '1', 'Admin logged in', '127.0.0.1');
    db.prepare("INSERT INTO audit_logs (admin_id, admin_email, action, entity_type, entity_id, details, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 days'))").run(1, 'admin@autozap.com', 'UPDATE', 'salon', '1', 'Updated salon commission rate', '127.0.0.1');
    db.prepare("INSERT INTO audit_logs (admin_id, admin_email, action, entity_type, entity_id, details, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-3 days'))").run(1, 'admin@autozap.com', 'CREATE', 'coupon', '1', 'Created coupon WELCOME20', '127.0.0.1');
    console.log('[Seed] audit_logs inserted');
  }

  // ── bot_states ──
  if (countRows('bot_states') === 0) {
    db.prepare("INSERT INTO bot_states (phone, state_data, updated_at) VALUES (?, ?, datetime('now', '-1 hour'))").run('+923001234561', '{"state":"menu","step":1,"context":{"salon_id":1}}');
    db.prepare("INSERT INTO bot_states (phone, state_data, updated_at) VALUES (?, ?, datetime('now', '-2 hours'))").run('+923001234562', '{"state":"booking","step":3,"context":{"salon_id":1,"service_id":2,"barber_id":2}}');
    console.log('[Seed] bot_states inserted');
  }

  // ── sent_notifications ──
  if (countRows('sent_notifications') === 0) {
    db.prepare("INSERT INTO sent_notifications (appointment_id, type, customer_phone, sent_at) VALUES (?, ?, ?, datetime('now', '-1 hour'))").run(1, 'reminder', '+923001234561');
    db.prepare("INSERT INTO sent_notifications (appointment_id, type, customer_phone, sent_at) VALUES (?, ?, ?, datetime('now', '-1 day'))").run(5, 'confirmation', '+923001234561');
    console.log('[Seed] sent_notifications inserted');
  }

  // ── recurring_bookings ──
  if (countRows('recurring_bookings') === 0) {
    db.prepare("INSERT INTO recurring_bookings (salon_id, barber_id, customer_phone, customer_name, service_id, appointment_time, end_time, frequency, day_of_week, status, next_date) VALUES (?, ?, ?, ?, ?, ?, ?, 'weekly', 1, 'active', date('now', '+7 days'))").run(1, 1, '+923001234561', 'Ahmed Raza', 1, '10:00', '10:30');
    db.prepare("INSERT INTO recurring_bookings (salon_id, barber_id, customer_phone, customer_name, service_id, appointment_time, end_time, frequency, day_of_week, status, next_date) VALUES (?, ?, ?, ?, ?, ?, ?, 'weekly', 3, 'active', date('now', '+14 days'))").run(1, 2, '+923001234564', 'Fatima Noor', 3, '14:00', '14:45');
    console.log('[Seed] recurring_bookings inserted');
  }

  // ── customer_preferences ──
  if (countRows('customer_preferences') === 0) {
    db.prepare("INSERT INTO customer_preferences (phone, pref_key, pref_value) VALUES (?, ?, ?)").run('+923001234561', 'preferred_barber', '1');
    db.prepare("INSERT INTO customer_preferences (phone, pref_key, pref_value) VALUES (?, ?, ?)").run('+923001234561', 'language', 'urdu');
    db.prepare("INSERT INTO customer_preferences (phone, pref_key, pref_value) VALUES (?, ?, ?)").run('+923001234564', 'language', 'english');
    console.log('[Seed] customer_preferences inserted');
  }

  // ── bot_paused ──
  if (countRows('bot_paused') === 0) {
    db.prepare("INSERT INTO bot_paused (phone, paused) VALUES (?, 0)").run('+923001234561');
    console.log('[Seed] bot_paused inserted');
  }

  // ── offers ──
  if (countRows('offers') === 0) {
    db.prepare("INSERT INTO offers (salon_id, title, description, discount_percent, valid_from, valid_until, is_active) VALUES (?, ?, ?, ?, date('now'), date('now', '+30 days'), 1)").run(1, 'First Visit Discount', '20% off on your first haircut', 20);
    db.prepare("INSERT INTO offers (salon_id, title, description, discount_percent, valid_from, valid_until, is_active) VALUES (?, ?, ?, ?, date('now'), date('now', '+30 days'), 1)").run(1, 'Combo Offer', 'Haircut + Beard at Rs. 700 only', 12.5);
    db.prepare("INSERT INTO offers (salon_id, title, description, discount_percent, valid_from, valid_until, is_active) VALUES (?, ?, ?, ?, date('now', '+7 days'), date('now', '+60 days'), 1)").run(1, 'Summer Special', '15% off on all services', 15);
    console.log('[Seed] offers inserted');
  }

  // ── automations ──
  if (countRows('automations') === 0) {
    db.prepare("INSERT INTO automations (salon_id, trigger_type, action_type, action_config, is_active) VALUES (?, ?, ?, ?, 1)").run(1, 'new_booking', 'send_whatsapp', '{"template":"appointment_reminder"}');
    db.prepare("INSERT INTO automations (salon_id, trigger_type, action_type, action_config, is_active) VALUES (?, ?, ?, ?, 0)").run(1, 'no_show', 'send_whatsapp', '{"template":"follow_up"}');
    console.log('[Seed] automations inserted');
  }

  // ── disputes ──
  if (countRows('disputes') === 0) {
    db.prepare("INSERT INTO disputes (salon_id, customer_phone, appointment_id, reason, status, created_at) VALUES (?, ?, ?, ?, 'open', datetime('now', '-5 days'))").run(1, '+923001234562', 2, 'Service not as expected');
    db.prepare("INSERT INTO disputes (salon_id, customer_phone, appointment_id, reason, status, created_at) VALUES (?, ?, ?, ?, 'resolved', datetime('now', '-10 days'))").run(1, '+923001234561', 5, 'Charged extra amount');
    console.log('[Seed] disputes inserted');
  }

  // ── payouts ──
  if (countRows('payouts') === 0) {
    db.prepare("INSERT INTO payouts (salon_id, amount, status, created_at) VALUES (?, ?, 'pending', datetime('now', '-2 days'))").run(1, 15000);
    db.prepare("INSERT INTO payouts (salon_id, amount, status, created_at, processed_at) VALUES (?, ?, 'completed', datetime('now', '-15 days'), datetime('now', '-13 days'))").run(1, 25000);
    console.log('[Seed] payouts inserted');
  }

  // ── salon_media ──
  if (countRows('salon_media') === 0) {
    db.prepare("INSERT INTO salon_media (salon_id, media_url, media_type, title, is_cover) VALUES (?, ?, 'image', 'Salon Front View', 1)").run(1, 'https://via.placeholder.com/800x400/1a1a2e/e94560?text=Salon+Front');
    db.prepare("INSERT INTO salon_media (salon_id, media_url, media_type, title, is_cover) VALUES (?, ?, 'image', 'Interior', 0)").run(1, 'https://via.placeholder.com/800x400/16213e/0f3460?text=Interior');
    console.log('[Seed] salon_media inserted');
  }

  // ── salon_portfolio ──
  if (countRows('salon_portfolio') === 0) {
    db.prepare("INSERT INTO salon_portfolio (salon_id, service_id, title, description, media_url, media_type) VALUES (?, ?, 'Haircut Showcase', 'Our best haircut styles', 'https://via.placeholder.com/400x400/1a1a2e/e94560?text=Haircut', 'image')").run(1, 1);
    db.prepare("INSERT INTO salon_portfolio (salon_id, service_id, title, description, media_url, media_type) VALUES (?, ?, 'Beard Styling', 'Beard transformation gallery', 'https://via.placeholder.com/400x400/16213e/0f3460?text=Beard', 'image')").run(1, 2);
    console.log('[Seed] salon_portfolio inserted');
  }

  // ── barber_portfolio ──
  if (countRows('barber_portfolio') === 0) {
    db.prepare("INSERT INTO barber_portfolio (barber_id, media_url, media_type, title) VALUES (?, ?, 'image', 'Haircut by Usman')").run(1, 'https://via.placeholder.com/400x400/e94560/ffffff?text=Usman+Cut');
    db.prepare("INSERT INTO barber_portfolio (barber_id, media_url, media_type, title) VALUES (?, ?, 'image', 'Beard by Usman')").run(1, 'https://via.placeholder.com/400x400/0f3460/ffffff?text=Usman+Beard');
    console.log('[Seed] barber_portfolio inserted');
  }

  console.log('\n[Seed] ✅ All tables seeded successfully!');
}

try {
  seed();
} catch (err: any) {
  console.error('[Seed] Error:', err.message);
  process.exit(1);
}
