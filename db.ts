import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { 
  Salon, Country, City, Area, SalonMedia, SalonReview, SalonPortfolio, 
  Customer, Staff, Service, Booking, Barber, BarberPortfolio, 
  BarberSchedule, Appointment, Review, Offer, Product, Admin 
} from './types';

dotenv.config();

export let pool: mysql.Pool;

function createPool() {
  const p = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'autozap_platform',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  });
  return p;
}

pool = createPool();

(pool as any).on('error', (err: any) => {
  console.error('[DB] Pool error:', err.message);
  if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
    console.log('[DB] Recreating pool after connection error...');
    const oldPool = pool;
    pool = createPool();
    oldPool.end().catch(() => {});
  }
});

// --- DB Core Functions ---

export async function query(sql: string, params: any[] = []): Promise<any> {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const [rows] = await pool.execute(sql, params);
      return rows;
    } catch (err: any) {
      const isLastAttempt = attempt === maxRetries;

      if (err.code === 'ER_NO_SUCH_TABLE') {
        const tableName = err.sqlMessage.match(/Table '.+\.(\w+)' doesn't exist/)?.[1];
        await autoCreateTable(tableName);
        if (tableName) {
          const [rows] = await pool.execute(sql, params);
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

async function autoCreateTable(tableName: string | undefined) {
  if (!tableName) return;
  switch (tableName) {
    case 'bot_states':
      await pool.execute(
        'CREATE TABLE IF NOT EXISTS bot_states (phone VARCHAR(20) PRIMARY KEY, state_data TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)'
      );
      break;
    case 'automations':
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
      break;
    case 'admins':
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
    case 'customers':
      await pool.execute(
        `CREATE TABLE IF NOT EXISTS customers (
          phone VARCHAR(20) PRIMARY KEY,
          name VARCHAR(100),
          global_points INT DEFAULT 0,
          loyalty_points INT DEFAULT 0,
          total_visits INT DEFAULT 0,
          referral_code VARCHAR(10) UNIQUE,
          last_status VARCHAR(50) DEFAULT 'idle',
          last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON DUPLICATE KEY UPDATE last_active = CURRENT_TIMESTAMP
        )`
      );
      try { await pool.execute('ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_status VARCHAR(50) DEFAULT "idle"'); } catch (_) {}
      break;

    case 'profile_visits':
      await pool.execute(
        `CREATE TABLE IF NOT EXISTS profile_visits (
          id INT AUTO_INCREMENT PRIMARY KEY,
          salon_id INT,
          barber_id INT DEFAULT NULL,
          customer_phone VARCHAR(20),
          visit_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
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
    default:
      console.warn(`[DB] Unknown table '${tableName}', creation not implemented`);
  }
}

export async function updateCustomerStatus(phone: string, status: string): Promise<void> {
  await query(
    'UPDATE customers SET last_status = ?, last_active = NOW() WHERE phone = ?',
    [status, phone]
  );
}

// --- Profile Visit Functions ---

export async function logProfileVisit(salonId: number, customerPhone: string, barberId?: number): Promise<void> {
  // Ensure tables exist (autoCreateTable will handle it on first query error, but we can be proactive or just query)
  try {
    await query(
      'INSERT INTO profile_visits (salon_id, barber_id, customer_phone) VALUES (?, ?, ?)',
      [salonId, barberId || null, customerPhone]
    );
  } catch (err: any) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      await autoCreateTable('profile_visits');
      await query(
        'INSERT INTO profile_visits (salon_id, barber_id, customer_phone) VALUES (?, ?, ?)',
        [salonId, barberId || null, customerPhone]
      );
    } else {
      throw err;
    }
  }
}

export async function getProfileVisits(salonId: number, limit: number = 50): Promise<any[]> {
  const rows = await query(
    `SELECT pv.*, c.name as customer_name, b.name as barber_name
     FROM profile_visits pv
     LEFT JOIN customers c ON pv.customer_phone = c.phone
     LEFT JOIN barbers b ON pv.barber_id = b.id
     WHERE pv.salon_id = ?
     ORDER BY pv.visit_time DESC LIMIT ?`,
    [salonId, limit]
  );
  return rows as any[];
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
  const rows = await query('SELECT * FROM salons');
  return rows as Salon[];
}

export async function getSalonById(id: number): Promise<Salon | null> {
  const rows = await query('SELECT * FROM salons WHERE id = ?', [id]);
  const salons = rows as Salon[];
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
  const rows = await query('SELECT * FROM customers');
  return rows as Customer[];
}

// --- Staff Functions ---

export async function getAllStaff(salonId?: number): Promise<Staff[]> {
  const sql = salonId ? 'SELECT * FROM staff WHERE salon_id = ?' : 'SELECT * FROM staff';
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
  const sql = salonId ? 'SELECT * FROM services WHERE salon_id = ?' : 'SELECT * FROM services';
  const rows = await query(sql, salonId ? [salonId] : []);
  return rows as Service[];
}

export async function getServicesBySalon(salonId: number): Promise<Service[]> {
  return await getAllServices(salonId);
}

export async function upsertService(service: Partial<Service> & { salon_id: number, name: string }): Promise<any> {
  if (service.id) {
    return await query(
      'UPDATE services SET name = ?, price = ?, duration = ? WHERE id = ? AND salon_id = ?',
      [service.name, service.price, service.duration, service.id, service.salon_id]
    );
  } else {
    return await query(
      'INSERT INTO services (salon_id, name, price, duration) VALUES (?, ?, ?, ?)',
      [service.salon_id, service.name, service.price, service.duration]
    );
  }
}

export async function deleteService(id: number): Promise<void> {
  await query('DELETE FROM services WHERE id = ?', [id]);
}

// --- Booking Functions ---

export async function createBooking(booking: Omit<Booking, 'id' | 'status'>): Promise<number> {
  const res: any = await query(
    'INSERT INTO bookings (salon_id, customer_phone, service_id, staff_id, booking_date, booking_time, token) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [booking.salon_id, booking.customer_phone, booking.service_id, booking.staff_id, booking.booking_date, booking.booking_time, booking.token]
  );
  return res.insertId;
}

export async function getAllBookings(salonId?: number): Promise<any[]> {
  const sql = salonId 
    ? `SELECT b.*, s.name as service_name, st.name as staff_name FROM bookings b 
       JOIN services s ON b.service_id = s.id 
       LEFT JOIN staff st ON b.staff_id = st.id 
       WHERE b.salon_id = ? ORDER BY b.created_at DESC`
    : `SELECT b.*, s.name as service_name, sl.name as salon_name, st.name as staff_name FROM bookings b 
       JOIN services s ON b.service_id = s.id 
       JOIN salons sl ON b.salon_id = sl.id
       LEFT JOIN staff st ON b.staff_id = st.id 
       ORDER BY b.created_at DESC`;
  const rows = await query(sql, salonId ? [salonId] : []);
  return rows as any[];
}

export async function getBookingsByPhone(phone: string): Promise<any[]> {
    const sql = `
        SELECT b.*, s.name as service_name, sl.name as salon_name 
        FROM bookings b
        JOIN services s ON b.service_id = s.id
        JOIN salons sl ON b.salon_id = sl.id
        WHERE b.customer_phone = ?
        ORDER BY b.booking_date DESC, b.booking_time DESC
    `;
    const rows = await query(sql, [phone]);
    return rows as any[];
}

export async function updateBookingStatus(id: number, status: string): Promise<void> {
  await query('UPDATE bookings SET status = ? WHERE id = ?', [status, id]);
}

export async function deleteBooking(id: number): Promise<void> {
  await query('DELETE FROM bookings WHERE id = ?', [id]);
}

// --- Bot State Functions ---

export async function getBotState(phone: string): Promise<any> {
    const rows: any = await query('SELECT state_data, updated_at FROM bot_states WHERE phone = ?', [phone]);
    if (rows.length === 0) return { step: 'IDLE' };
    const state = JSON.parse(rows[0].state_data);
    state.updatedAt = rows[0].updated_at ? new Date(rows[0].updated_at).getTime() : Date.now();
    return state;
}

export async function saveBotState(phone: string, state: any): Promise<void> {
    const stateData = JSON.stringify(state);
    await query(
        'INSERT INTO bot_states (phone, state_data) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_data = ?',
        [phone, stateData, stateData]
    );
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

export async function updateWorkingHours(salonId: number, hours: any[]): Promise<void> {
  await query('DELETE FROM working_hours WHERE salon_id = ?', [salonId]);
  for (const h of hours) {
    await query(
      'INSERT INTO working_hours (salon_id, day, start_time, end_time, is_open) VALUES (?, ?, ?, ?, ?)',
      [salonId, h.day, h.start, h.end, h.isOpen ? 1 : 0]
    );
  }
}

// --- Seat Functions ---

export async function getAllSeats(salonId: number): Promise<any[]> {
  return await query('SELECT * FROM seats WHERE salon_id = ?', [salonId]) as any[];
}

export async function upsertSeat(seat: any): Promise<any> {
  if (seat.id) {
    return await query(
      'UPDATE seats SET name = ?, status = ?, assigned_staff_id = ? WHERE id = ? AND salon_id = ?',
      [seat.name, seat.status, seat.assigned_staff_id, seat.id, seat.salon_id]
    );
  } else {
    return await query(
      'INSERT INTO seats (salon_id, name, status, assigned_staff_id) VALUES (?, ?, ?, ?)',
      [seat.salon_id, seat.name, seat.status || 'Available', seat.assigned_staff_id]
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
  const rows = await query('SELECT * FROM countries WHERE is_active = TRUE ORDER BY name');
  return rows as Country[];
}

export async function getCitiesByCountry(countryId: number): Promise<City[]> {
  const rows = await query('SELECT * FROM cities WHERE country_id = ? AND is_active = TRUE ORDER BY name', [countryId]);
  return rows as City[];
}

export async function getAreasByCity(cityId: number): Promise<Area[]> {
  const rows = await query('SELECT * FROM areas WHERE city_id = ? AND is_active = TRUE ORDER BY name', [cityId]);
  return rows as Area[];
}

// --- Enhanced Salon Functions ---

export async function getSalonsByLocation(countryId?: number, cityId?: number, areaId?: number): Promise<Salon[]> {
  let sql = 'SELECT s.* FROM salons s WHERE s.status = "active"';
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
  const sql = salonId ? 'SELECT * FROM products WHERE salon_id = ?' : 'SELECT * FROM products';
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

export async function getBarbersBySalon(salonId: number): Promise<Barber[]> {
  const rows = await query('SELECT * FROM barbers WHERE salon_id = ? AND status = "active" ORDER BY rating DESC', [salonId]);
  return rows as Barber[];
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

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export async function getAvailableSlots(barberId: number, date: string, buffer: number = 5): Promise<{ start: string, end: string }[]> {
  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay();

  // 1. Get barber schedule for that day
  const schedules = await getBarberSchedule(barberId, dayOfWeek);
  if (schedules.length === 0 || !schedules[0].is_available) return [];

  const schedule = schedules[0];

  // 2. Generate all possible slots
  const allSlots = generateTimeSlots(schedule.start_time, schedule.end_time, schedule.slot_duration, buffer);

  // 3. Get existing appointments for that date (excluding cancelled/no_show)
  const appointments = await query(
    `SELECT appointment_time, end_time FROM appointments 
     WHERE barber_id = ? AND appointment_date = ? 
     AND status NOT IN ('cancelled', 'no_show')`,
    [barberId, date]
  ) as any[];

  // 4. Check if barber is currently busy (for today only)
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const isToday = date === now.toISOString().split('T')[0];

  // 5. Filter out booked and past slots
  const availableSlots = allSlots.filter(slot => {
    const slotStart = timeToMinutes(slot.start);

    // Remove past slots (for today)
    if (isToday && slotStart <= currentMinutes) return false;

    // Remove already booked slots
    const isBooked = appointments.some((apt: any) => {
      const aptStart = timeToMinutes(String(apt.appointment_time));
      const aptEnd = timeToMinutes(String(apt.end_time));
      return slotStart >= aptStart && slotStart < aptEnd;
    });

    return !isBooked;
  });

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
  // Double booking check
  const existing = await query(
    `SELECT id FROM appointments 
     WHERE barber_id = ? AND appointment_date = ? AND appointment_time = ? 
     AND status NOT IN ('cancelled', 'no_show')`,
    [data.barber_id, data.appointment_date, data.appointment_time]
  ) as any[];

  if (existing.length > 0) {
    return { success: false, error: 'Yeh slot already booked hai.' };
  }

  try {
    const res: any = await query(
      `INSERT INTO appointments (salon_id, barber_id, customer_phone, customer_name, service_id, appointment_date, appointment_time, end_time, token, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
      [data.salon_id, data.barber_id, data.customer_phone, data.customer_name, data.service_id, data.appointment_date, data.appointment_time, data.end_time, data.token]
    );
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
    `SELECT * FROM appointments WHERE barber_id = ? AND appointment_date = ? AND status NOT IN ('cancelled', 'no_show') ORDER BY appointment_time`,
    [barberId, date]
  );
  return rows as Appointment[];
}

export async function getCurrentAppointment(barberId: number): Promise<Appointment | null> {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const rows = await query(
    `SELECT * FROM appointments 
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
  const rows = await query('SELECT * FROM customers WHERE phone = ?', [phone]);
  return rows.length > 0 ? rows[0] : null;
}

export async function addCustomerPoints(phone: string, points: number): Promise<void> {
  await query('UPDATE customers SET global_points = global_points + ? WHERE phone = ?', [points, phone]);
}

export async function getCustomerByReferralCode(code: string): Promise<Customer | null> {
  const rows: any = await query('SELECT * FROM customers WHERE referral_code = ?', [code]);
  return rows.length > 0 ? rows[0] : null;
}

export async function upsertCustomer(name: string, phone: string): Promise<void> {
  await query(
    'INSERT INTO customers (phone, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = ?',
    [phone, name, name]
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
  return res.insertId;
}

// --- Offer Functions ---

export async function getOffersBySalon(salonId: number): Promise<Offer[]> {
  const today = new Date().toISOString().split('T')[0];
  const rows = await query(
    "SELECT * FROM offers WHERE salon_id = ? AND is_active = TRUE AND valid_from <= ? AND valid_until >= ?",
    [salonId, today, today]
  );
  return rows as Offer[];
}

// --- Salon Detail (enhanced) ---

export async function getSalonDetailForBot(salonId: number): Promise<any> {
  const rows = await query(`
    SELECT s.*, c.name as city_name, a.name as area_name 
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

// --- Expense Functions (for Finances page) ---

export async function getAllExpenses(): Promise<any[]> {
  const rows = await query('SELECT * FROM expenses ORDER BY date DESC');
  return rows as any[];
}

export async function deleteExpense(id: number): Promise<void> {
  await query('DELETE FROM expenses WHERE id = ?', [id]);
}

// --- Revenue Functions (for Finances page) ---

export async function getAllRevenue(): Promise<any[]> {
  const rows = await query('SELECT * FROM revenue ORDER BY date DESC');
  return rows as any[];
}

export async function deleteRevenue(id: number): Promise<void> {
  await query('DELETE FROM revenue WHERE id = ?', [id]);
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
       FROM messages WHERE session_id = ?
       GROUP BY phone, push_name ORDER BY timestamp DESC`
    : `SELECT phone, push_name as name, MAX(text) as lastMessage, MAX(timestamp) as timestamp
       FROM messages GROUP BY phone, push_name ORDER BY timestamp DESC`;
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
  await query(
    'INSERT INTO customers (phone, last_active, status) VALUES (?, CURDATE(), 1) ON DUPLICATE KEY UPDATE last_active = CURDATE(), status = 1',
    [phone]
  );
}

export async function getSalonCustomerChats(salonId: number): Promise<any[]> {
  const rows = await query(
    `SELECT DISTINCT m.phone, m.push_name as name, MAX(m.text) as lastMessage, MAX(m.timestamp) as timestamp
     FROM messages m
     LEFT JOIN appointments a ON a.customer_phone = REPLACE(m.phone, '@s.whatsapp.net', '') AND a.salon_id = ?
     LEFT JOIN profile_visits pv ON pv.customer_phone = REPLACE(m.phone, '@s.whatsapp.net', '') AND pv.salon_id = ?
     WHERE a.id IS NOT NULL OR pv.id IS NOT NULL
     GROUP BY m.phone, m.push_name ORDER BY timestamp DESC`,
    [salonId, salonId]
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
  const r: any = await query(
    'INSERT INTO admins (name, email, password, role) VALUES (?, ?, ?, ?)',
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
  await query('DELETE FROM admins WHERE id = ? AND role != "super_admin"', [id]);
}

export async function updateAdminLogin(id: number): Promise<void> {
  await query('UPDATE admins SET last_login = NOW() WHERE id = ?', [id]);
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
  await query(
    'INSERT INTO audit_logs (admin_id, admin_email, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [log.admin_id || null, log.admin_email || null, log.action, log.entity_type || null, log.entity_id || null, log.details || null, log.ip_address || null]
  );
}

export async function getAuditLogs(limit: number = 100, offset: number = 0): Promise<AuditLog[]> {
  const rows = await query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]);
  return rows as AuditLog[];
}

// --- Platform Settings Functions ---

export async function getAllSettings(): Promise<PlatformSetting[]> {
  const rows = await query('SELECT * FROM platform_settings ORDER BY setting_key');
  return rows as PlatformSetting[];
}

export async function getSetting(key: string): Promise<string | null> {
  const rows: any = await query('SELECT setting_value FROM platform_settings WHERE setting_key = ?', [key]);
  return rows.length > 0 ? rows[0].setting_value : null;
}

export async function upsertSetting(setting: { setting_key: string; setting_value: string; setting_type?: string; description?: string; updated_by?: number }): Promise<void> {
  await query(
    'INSERT INTO platform_settings (setting_key, setting_value, setting_type, description, updated_by) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?, setting_type = ?, description = ?, updated_by = ?',
    [setting.setting_key, setting.setting_value, setting.setting_type || 'string', setting.description || null, setting.updated_by || null,
     setting.setting_value, setting.setting_type || 'string', setting.description || null, setting.updated_by || null]
  );
}

export async function deleteSetting(key: string): Promise<void> {
  await query('DELETE FROM platform_settings WHERE setting_key = ?', [key]);
}

// --- Payout Functions ---

export async function getPayouts(status?: string): Promise<Payout[]> {
  let sql = `SELECT p.*, s.name as salon_name, s.owner_name FROM payouts p JOIN salons s ON p.salon_id = s.id`;
  const params: any[] = [];
  if (status) { sql += ' WHERE p.status = ?'; params.push(status); }
  sql += ' ORDER BY p.requested_at DESC';
  const rows = await query(sql, params);
  return rows as Payout[];
}

export async function getPayoutsBySalon(salonId: number): Promise<Payout[]> {
  const rows = await query('SELECT * FROM payouts WHERE salon_id = ? ORDER BY requested_at DESC', [salonId]);
  return rows as Payout[];
}

export async function createPayout(data: { salon_id: number; amount: number; method: string; account_details?: string }): Promise<number> {
  const r: any = await query(
    'INSERT INTO payouts (salon_id, amount, method, account_details) VALUES (?, ?, ?, ?)',
    [data.salon_id, data.amount, data.method, data.account_details || null]
  );
  return r.insertId;
}

export async function updatePayoutStatus(id: number, status: string, adminId: number, notes?: string): Promise<void> {
  await query(
    'UPDATE payouts SET status = ?, processed_at = NOW(), processed_by = ?, admin_notes = ? WHERE id = ?',
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
  await query(
    'UPDATE disputes SET status = ?, resolution = ?, resolved_by = ?, resolved_at = NOW() WHERE id = ?',
    [status, resolution, adminId, id]
  );
}

// --- Coupon Functions ---

export async function getCoupons(): Promise<Coupon[]> {
  const rows = await query('SELECT * FROM coupons ORDER BY created_at DESC');
  return rows as Coupon[];
}

export async function createCoupon(data: { code: string; type: string; value: number; min_amount?: number; max_uses?: number; valid_from?: string; valid_until?: string; created_by?: number }): Promise<number> {
  const r: any = await query(
    'INSERT INTO coupons (code, type, value, min_amount, max_uses, valid_from, valid_until, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [data.code.toUpperCase(), data.type, data.value, data.min_amount || 0, data.max_uses || 0, data.valid_from || null, data.valid_until || null, data.created_by || null]
  );
  return r.insertId;
}

export async function deleteCoupon(id: number): Promise<void> {
  await query('DELETE FROM coupons WHERE id = ?', [id]);
}

// --- Template Functions ---

export async function getTemplates(): Promise<Template[]> {
  const rows = await query('SELECT * FROM templates ORDER BY name');
  return rows as Template[];
}

export async function getTemplateByName(name: string): Promise<Template | null> {
  const rows = await query('SELECT * FROM templates WHERE name = ?', [name]);
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
  const rows = await query('SELECT * FROM broadcast_notifications ORDER BY created_at DESC');
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
  await query(
    "UPDATE broadcast_notifications SET status = 'sent', sent_at = NOW() WHERE id = ?",
    [id]
  );
}

// --- System Health ---

export async function getSystemHealth(): Promise<any> {
  const [dbCheck] = await pool.execute('SELECT 1 as alive') as any[];
  const dbAlive = dbCheck && dbCheck[0]?.alive === 1;
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
  const today = new Date().toISOString().split('T')[0];
  const rows = await query(
    `SELECT o.*, s.name as salon_name FROM offers o
     JOIN salons s ON o.salon_id = s.id
     WHERE o.is_active = TRUE AND o.valid_from <= ? AND o.valid_until >= ?`,
    [today, today]
  );
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
  // Verify PIN matches barber
  const barber: any = await query('SELECT id, pin_code FROM barbers WHERE id = ? AND salon_id = ?', [barberId, salonId]);
  if (barber.length === 0) return { success: false, error: 'Barber not found' };
  if (barber[0].pin_code !== pinCode) return { success: false, error: 'Invalid PIN' };
  // Check already clocked in today
  const today = new Date().toISOString().split('T')[0];
  const existing: any = await query(
    "SELECT id FROM barber_attendance WHERE barber_id = ? AND date = ? AND status = 'clocked_in'",
    [barberId, today]
  );
  if (existing.length > 0) return { success: false, error: 'Already clocked in today' };
  await query(
    'INSERT INTO barber_attendance (barber_id, salon_id, date, clock_in, pin_code, source) VALUES (?, ?, ?, NOW(), ?, ?)',
    [barberId, salonId, today, pinCode, source]
  );
  return { success: true };
}

export async function clockOutBarber(barberId: number, salonId: number, pinCode: string): Promise<{ success: boolean; error?: string }> {
  const barber: any = await query('SELECT id, pin_code FROM barbers WHERE id = ? AND salon_id = ?', [barberId, salonId]);
  if (barber.length === 0) return { success: false, error: 'Barber not found' };
  if (barber[0].pin_code !== pinCode) return { success: false, error: 'Invalid PIN' };
  const today = new Date().toISOString().split('T')[0];
  const existing: any = await query(
    "SELECT id FROM barber_attendance WHERE barber_id = ? AND date = ? AND status = 'clocked_in'",
    [barberId, today]
  );
  if (existing.length === 0) return { success: false, error: 'Not clocked in today' };
  await query(
    "UPDATE barber_attendance SET clock_out = NOW(), status = 'clocked_out' WHERE barber_id = ? AND date = ? AND status = 'clocked_in'",
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

export async function getAttendanceHistory(salonId: number, days: number = 30): Promise<any[]> {
  const rows = await query(
    `SELECT ba.*, b.name as barber_name
     FROM barber_attendance ba
     JOIN barbers b ON ba.barber_id = b.id
     WHERE ba.salon_id = ? AND ba.date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     ORDER BY ba.date DESC, ba.clock_in DESC`,
    [salonId, days]
  );
  return rows as any[];
}
