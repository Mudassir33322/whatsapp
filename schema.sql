CREATE DATABASE IF NOT EXISTS autozap_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE autozap_platform;

-- Countries
CREATE TABLE IF NOT EXISTS countries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(10) DEFAULT NULL,
  phone_code VARCHAR(10) DEFAULT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cities
CREATE TABLE IF NOT EXISTS cities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  country_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE
);

-- Areas
CREATE TABLE IF NOT EXISTS areas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  city_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE
);

-- Salons
CREATE TABLE IF NOT EXISTS salons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  owner_name VARCHAR(100) DEFAULT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  email VARCHAR(100) DEFAULT NULL,
  password VARCHAR(255) DEFAULT NULL,
  owner_phone VARCHAR(20) DEFAULT NULL,
  country_id INT DEFAULT NULL,
  city_id INT DEFAULT NULL,
  area_id INT DEFAULT NULL,
  address TEXT DEFAULT NULL,
  description TEXT DEFAULT NULL,
  portfolio_url VARCHAR(500) DEFAULT NULL,
  cover_image VARCHAR(500) DEFAULT NULL,
  logo VARCHAR(500) DEFAULT NULL,
  cover_image_url VARCHAR(500) DEFAULT NULL,
  logo_url VARCHAR(500) DEFAULT NULL,
  established_year INT DEFAULT NULL,
  rating DECIMAL(2,1) DEFAULT 0.0,
  review_count INT DEFAULT 0,
  latitude DECIMAL(10,8) DEFAULT NULL,
  longitude DECIMAL(11,8) DEFAULT NULL,
  status ENUM('active', 'inactive', 'pending') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE SET NULL,
  FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL,
  FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  phone VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100) DEFAULT NULL,
  global_points INT DEFAULT 0,
  loyalty_points INT DEFAULT 0,
  total_visits INT DEFAULT 0,
  referral_code VARCHAR(20) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Staff
CREATE TABLE IF NOT EXISTS staff (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(50) DEFAULT 'Barber',
  salary_type ENUM('fixed', 'commission') DEFAULT 'fixed',
  base_salary DECIMAL(12,2) DEFAULT 0,
  commission_rate DECIMAL(5,2) DEFAULT 0,
  phone VARCHAR(20) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- Services
CREATE TABLE IF NOT EXISTS services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT DEFAULT NULL,
  price DECIMAL(12,2) NOT NULL,
  duration INT DEFAULT 30,
  category VARCHAR(100) DEFAULT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- Barbers
CREATE TABLE IF NOT EXISTS barbers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  email VARCHAR(100) DEFAULT NULL,
  bio TEXT DEFAULT NULL,
  experience INT DEFAULT 0,
  specialization VARCHAR(200) DEFAULT NULL,
  profile_image VARCHAR(500) DEFAULT NULL,
  rating DECIMAL(2,1) DEFAULT 0.0,
  review_count INT DEFAULT 0,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- Barber Portfolio
CREATE TABLE IF NOT EXISTS barber_portfolio (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barber_id INT NOT NULL,
  media_url VARCHAR(500) NOT NULL,
  media_type ENUM('image', 'video') DEFAULT 'image',
  title VARCHAR(200) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE
);

-- Barber Schedule
CREATE TABLE IF NOT EXISTS barber_schedule (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barber_id INT NOT NULL,
  day_of_week TINYINT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_duration INT DEFAULT 30,
  is_available BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE
);

-- Barber-Service linking
CREATE TABLE IF NOT EXISTS barber_services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barber_id INT NOT NULL,
  service_id INT NOT NULL,
  price DECIMAL(12,2) DEFAULT NULL,
  UNIQUE KEY uk_barber_service (barber_id, service_id),
  FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- Appointments
CREATE TABLE IF NOT EXISTS appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  barber_id INT NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_name VARCHAR(100) DEFAULT NULL,
  service_id INT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status ENUM('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show') DEFAULT 'pending',
  token VARCHAR(10) NOT NULL UNIQUE,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_salon_date (salon_id, appointment_date),
  INDEX idx_barber_date (barber_id, appointment_date),
  INDEX idx_token (token),
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE,
  FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- Legacy bookings (kept for backward compatibility)
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  service_id INT NOT NULL,
  staff_id INT DEFAULT NULL,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  status ENUM('pending', 'confirmed', 'cancelled', 'completed') DEFAULT 'confirmed',
  token VARCHAR(10) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
);

-- Bot conversation states
CREATE TABLE IF NOT EXISTS bot_states (
  phone VARCHAR(20) PRIMARY KEY,
  state_data TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  barber_id INT DEFAULT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  rating TINYINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE,
  FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE SET NULL
);

-- Salon media
CREATE TABLE IF NOT EXISTS salon_media (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  media_url VARCHAR(500) NOT NULL,
  media_type ENUM('image', 'video') DEFAULT 'image',
  title VARCHAR(200) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  display_order INT DEFAULT 0,
  is_cover BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- Salon portfolio
CREATE TABLE IF NOT EXISTS salon_portfolio (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  service_id INT DEFAULT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT DEFAULT NULL,
  media_url VARCHAR(500) NOT NULL,
  media_type ENUM('image', 'video') DEFAULT 'image',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
);

-- Offers
CREATE TABLE IF NOT EXISTS offers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT DEFAULT NULL,
  discount_percent DECIMAL(5,2) DEFAULT NULL,
  valid_from DATE DEFAULT NULL,
  valid_until DATE DEFAULT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- Products
CREATE TABLE IF NOT EXISTS products (
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
);

-- Seats
CREATE TABLE IF NOT EXISTS seats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'Available',
  assigned_staff_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_staff_id) REFERENCES staff(id) ON DELETE SET NULL
);

-- Working hours
CREATE TABLE IF NOT EXISTS working_hours (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  day VARCHAR(20) NOT NULL,
  day_of_week TINYINT DEFAULT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_open BOOLEAN DEFAULT TRUE,
  is_off BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- Salaries
CREATE TABLE IF NOT EXISTS salaries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  staff_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  type ENUM('Salary', 'Commission', 'Bonus', 'Advance') DEFAULT 'Salary',
  status VARCHAR(20) DEFAULT 'Paid',
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- Revenue
CREATE TABLE IF NOT EXISTS revenue (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  booking_id INT DEFAULT NULL,
  amount DECIMAL(12,2) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  category VARCHAR(100) DEFAULT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- Shop settings
CREATE TABLE IF NOT EXISTS shop_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL UNIQUE,
  company_name VARCHAR(200) DEFAULT 'AutoZap Salon',
  currency VARCHAR(10) DEFAULT 'Rs.',
  language VARCHAR(50) DEFAULT 'Urdu/English',
  address TEXT DEFAULT NULL,
  map_url VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL UNIQUE,
  reminder_30min BOOLEAN DEFAULT TRUE,
  queue_update BOOLEAN DEFAULT TRUE,
  review_request BOOLEAN DEFAULT TRUE,
  re_engagement BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- Sent notifications tracking
CREATE TABLE IF NOT EXISTS sent_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT DEFAULT 0,
  type VARCHAR(50) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_appointment_type (appointment_id, type),
  INDEX idx_customer_type (customer_phone, type)
);

-- Chat messages for Inbox
CREATE TABLE IF NOT EXISTS messages (
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
);

-- Bot paused state per phone
CREATE TABLE IF NOT EXISTS bot_paused (
  phone VARCHAR(20) PRIMARY KEY,
  paused BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Customer tags
CREATE TABLE IF NOT EXISTS customer_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_phone VARCHAR(20) NOT NULL,
  tag VARCHAR(50) NOT NULL,
  UNIQUE KEY uk_customer_tag (customer_phone, tag),
  FOREIGN KEY (customer_phone) REFERENCES customers(phone) ON DELETE CASCADE
);

-- ================================================================
-- SUPER ADMIN NEW FEATURES (Jun 2026)
-- ================================================================

-- 1. Multiple Admins / Sub-Admins
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('super_admin', 'admin', 'support', 'viewer') DEFAULT 'admin',
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT DEFAULT NULL,
  admin_email VARCHAR(100) DEFAULT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) DEFAULT NULL,
  entity_id VARCHAR(50) DEFAULT NULL,
  details TEXT DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin (admin_id),
  INDEX idx_action (action),
  INDEX idx_created (created_at)
);

-- 3. Platform Settings
CREATE TABLE IF NOT EXISTS platform_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
  description VARCHAR(255) DEFAULT NULL,
  updated_by INT DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 4. Payouts / Withdrawals
CREATE TABLE IF NOT EXISTS payouts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  method ENUM('bank', 'jazzcash', 'easypaisa', 'other') DEFAULT 'bank',
  account_details TEXT DEFAULT NULL,
  status ENUM('pending', 'approved', 'paid', 'rejected') DEFAULT 'pending',
  admin_notes TEXT DEFAULT NULL,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL,
  processed_by INT DEFAULT NULL,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE,
  FOREIGN KEY (processed_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 5. Disputes
CREATE TABLE IF NOT EXISTS disputes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT DEFAULT NULL,
  customer_phone VARCHAR(20) DEFAULT NULL,
  appointment_id INT DEFAULT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT DEFAULT NULL,
  status ENUM('open', 'under_review', 'resolved', 'closed') DEFAULT 'open',
  resolution TEXT DEFAULT NULL,
  resolved_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE SET NULL,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 6. Platform Coupons / Promos
CREATE TABLE IF NOT EXISTS coupons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  type ENUM('percentage', 'flat') NOT NULL,
  value DECIMAL(12,2) NOT NULL,
  min_amount DECIMAL(12,2) DEFAULT 0,
  max_uses INT DEFAULT 0,
  used_count INT DEFAULT 0,
  valid_from DATE DEFAULT NULL,
  valid_until DATE DEFAULT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 7. Email / SMS Templates
CREATE TABLE IF NOT EXISTS templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  type ENUM('email', 'sms', 'whatsapp') DEFAULT 'email',
  subject VARCHAR(255) DEFAULT NULL,
  body TEXT NOT NULL,
  variables TEXT DEFAULT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  updated_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 8. Broadcast Notifications
CREATE TABLE IF NOT EXISTS broadcast_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('info', 'warning', 'urgent') DEFAULT 'info',
  target ENUM('all_salons', 'active_salons', 'all_customers') DEFAULT 'all_salons',
  status ENUM('draft', 'sent', 'scheduled') DEFAULT 'draft',
  scheduled_at TIMESTAMP NULL,
  sent_at TIMESTAMP NULL,
  sent_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sent_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 9. Salon Commission (add commission_rate to salons)
ALTER TABLE salons ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) DEFAULT 0.00 AFTER status;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS commission_type ENUM('percentage', 'fixed') DEFAULT 'percentage' AFTER commission_rate;

-- 10. Recurring Bookings (auto-repeat appointments weekly/monthly)
CREATE TABLE IF NOT EXISTS recurring_bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  barber_id INT NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_name VARCHAR(100) DEFAULT NULL,
  service_id INT NOT NULL,
  appointment_time TIME NOT NULL,
  end_time TIME NOT NULL,
  frequency ENUM('weekly','monthly') NOT NULL,
  day_of_week TINYINT DEFAULT NULL COMMENT '1=Mon, 7=Sun (for weekly)',
  day_of_month TINYINT DEFAULT NULL COMMENT '1-31 (for monthly)',
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
);

-- 11. Barber Attendance (QR/PIN clock in/out)
CREATE TABLE IF NOT EXISTS barber_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barber_id INT NOT NULL,
  salon_id INT NOT NULL,
  date DATE NOT NULL,
  clock_in DATETIME NOT NULL,
  clock_out DATETIME DEFAULT NULL,
  pin_code VARCHAR(6) NOT NULL,
  status ENUM('clocked_in', 'clocked_out') DEFAULT 'clocked_in',
  source ENUM('portal','scan') DEFAULT 'portal',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_barber_date (barber_id, date),
  FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- Add pin_code to barbers for attendance
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS pin_code VARCHAR(6) DEFAULT NULL AFTER status;

-- Add status & last_active to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status TINYINT(1) DEFAULT 0 AFTER total_visits;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_active DATE DEFAULT NULL AFTER status;

-- 12. Customer Preferences (for bot)
CREATE TABLE IF NOT EXISTS customer_preferences (
  phone VARCHAR(20) NOT NULL,
  pref_key VARCHAR(50) NOT NULL,
  pref_value TEXT,
  PRIMARY KEY (phone, pref_key)
);
