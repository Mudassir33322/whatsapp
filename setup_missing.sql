-- Create all missing tables for the platform

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  price DECIMAL(10,2) DEFAULT 0,
  stock INT DEFAULT 0,
  min_stock INT DEFAULT 5,
  unit VARCHAR(20) DEFAULT 'pcs',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin','super_admin') DEFAULT 'admin',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payouts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending','paid','failed') DEFAULT 'pending',
  payout_date DATE DEFAULT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS disputes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT DEFAULT NULL,
  customer_phone VARCHAR(20) DEFAULT NULL,
  salon_id INT DEFAULT NULL,
  reason TEXT,
  status ENUM('open','resolved','closed') DEFAULT 'open',
  resolution TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE SET NULL
);

-- Add pin_code column to barbers if not exists
SET @dbname = 'autozap_platform';
SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'barbers' AND COLUMN_NAME = 'pin_code');
SET @sql = IF(@exists = 0, 'ALTER TABLE barbers ADD COLUMN pin_code VARCHAR(6) DEFAULT NULL AFTER status', 'SELECT "pin_code already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create recurring_bookings table
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
);

-- Create barber_attendance table
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

-- Create initial super admin (password: admin123)
INSERT IGNORE INTO admins (name, email, password, role) VALUES ('Super Admin', 'super@admin.com', '$2a$10$8K1p/a0dL1LXMIgoEDFrwOfMQkfAjkMBcGmXlGQqYWHoRM6y0J5Sa', 'super_admin');
