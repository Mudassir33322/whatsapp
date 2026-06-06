-- =============================================================
-- PHASE 1: COMPLETE DATABASE SETUP
-- =============================================================

-- 1.1 COUNTRIES
CREATE TABLE IF NOT EXISTS countries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone_code VARCHAR(10) DEFAULT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

-- 1.2 CITIES
CREATE TABLE IF NOT EXISTS cities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  country_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE
);

-- 1.3 AREAS
CREATE TABLE IF NOT EXISTS areas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  city_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE
);

-- 1.4 SALONS
CREATE TABLE IF NOT EXISTS salons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_name VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255),
  country_id INT,
  city_id INT,
  area_id INT,
  address TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  cover_image VARCHAR(500),
  logo VARCHAR(500),
  description TEXT,
  rating DECIMAL(2,1) DEFAULT 0.0,
  review_count INT DEFAULT 0,
  status ENUM('active','inactive','pending') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (country_id) REFERENCES countries(id),
  FOREIGN KEY (city_id) REFERENCES cities(id),
  FOREIGN KEY (area_id) REFERENCES areas(id)
);

-- 1.5 SALON MEDIA
CREATE TABLE IF NOT EXISTS salon_media (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  media_url VARCHAR(500) NOT NULL,
  media_type ENUM('image','video') DEFAULT 'image',
  title VARCHAR(255),
  is_cover BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- 1.6 WORKING HOURS
CREATE TABLE IF NOT EXISTS working_hours (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  day_of_week TINYINT NOT NULL COMMENT '0=Sunday, 1=Monday...6=Saturday',
  start_time TIME,
  end_time TIME,
  is_off BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- 1.7 BARBERS
CREATE TABLE IF NOT EXISTS barbers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  bio TEXT,
  experience INT DEFAULT 0 COMMENT 'Years of experience',
  specialization VARCHAR(255),
  profile_image VARCHAR(500),
  rating DECIMAL(2,1) DEFAULT 0.0,
  review_count INT DEFAULT 0,
  status ENUM('active','inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- 1.8 BARBER PORTFOLIO
CREATE TABLE IF NOT EXISTS barber_portfolio (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barber_id INT NOT NULL,
  media_url VARCHAR(500) NOT NULL,
  media_type ENUM('image','video') DEFAULT 'image',
  title VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE
);

-- 1.9 BARBER SCHEDULE
CREATE TABLE IF NOT EXISTS barber_schedule (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barber_id INT NOT NULL,
  day_of_week TINYINT NOT NULL COMMENT '0=Sunday, 1=Monday...6=Saturday',
  start_time TIME,
  end_time TIME,
  slot_duration INT DEFAULT 30 COMMENT 'Minutes',
  is_available BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE
);

-- 1.10 SERVICES
CREATE TABLE IF NOT EXISTS services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  duration INT NOT NULL COMMENT 'Minutes',
  category VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- 1.11 BARBER SERVICES (link barbers to services with optional custom price)
CREATE TABLE IF NOT EXISTS barber_services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barber_id INT NOT NULL,
  service_id INT NOT NULL,
  price DECIMAL(10,2),
  FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  UNIQUE(barber_id, service_id)
);

-- 1.12 APPOINTMENTS (with double-booking prevention)
CREATE TABLE IF NOT EXISTS appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  barber_id INT NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_name VARCHAR(255),
  service_id INT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status ENUM('pending','confirmed','in_progress','completed','cancelled','no_show') DEFAULT 'pending',
  token VARCHAR(10) UNIQUE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE,
  FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  UNIQUE KEY no_double_book (barber_id, appointment_date, appointment_time)
);

-- 1.13 REVIEWS
CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  barber_id INT,
  customer_phone VARCHAR(20) NOT NULL,
  rating TINYINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE,
  FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE SET NULL
);

-- 1.14 OFFERS
CREATE TABLE IF NOT EXISTS offers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  discount_percent INT,
  valid_from DATE,
  valid_until DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- 1.15 CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255),
  total_visits INT DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0.00,
  loyalty_points INT DEFAULT 0,
  tier ENUM('bronze','silver','gold','platinum') DEFAULT 'bronze',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1.16 SENT NOTIFICATIONS
CREATE TABLE IF NOT EXISTS sent_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT,
  type VARCHAR(50) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_type_appt (type, appointment_id),
  INDEX idx_phone (customer_phone)
);

-- 1.17 NOTIFICATION PREFERENCES
CREATE TABLE IF NOT EXISTS notification_preferences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  salon_id INT UNIQUE NOT NULL,
  reminder_30min BOOLEAN DEFAULT TRUE,
  queue_update BOOLEAN DEFAULT TRUE,
  review_request BOOLEAN DEFAULT TRUE,
  re_engagement BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- =============================================================
-- SEED DATA
-- =============================================================

-- COUNTRIES
INSERT INTO countries (id, name) VALUES
(1, 'Pakistan'),
(2, 'India');

-- CITIES (Pakistan)
INSERT INTO cities (id, country_id, name) VALUES
(1, 1, 'Karachi'),
(2, 1, 'Lahore'),
(3, 1, 'Hyderabad'),
(4, 1, 'Islamabad'),
(5, 1, 'Peshawar'),
(6, 1, 'Quetta');

-- AREAS (Karachi)
INSERT INTO areas (city_id, name) VALUES
(1, 'Liyari'),
(1, 'DHA'),
(1, 'Gulshan-e-Maymar'),
(1, 'Clifton'),
(1, 'Saddar'),
(1, 'Nazimabad'),
(1, 'Gulistan-e-Jauhar'),
(1, 'Korangi'),
(1, 'Malir'),
(1, 'North Nazimabad');

-- AREAS (Lahore)
INSERT INTO areas (city_id, name) VALUES
(2, 'Gulberg'),
(2, 'Model Town'),
(2, 'Johar Town'),
(2, 'Defence'),
(2, 'Cantt'),
(2, 'Iqbal Town');

-- AREAS (Hyderabad)
INSERT INTO areas (city_id, name) VALUES
(3, 'Latifabad'),
(3, 'Qasimabad'),
(3, 'City Centre'),
(3, 'Hussainabad');

-- AREAS (Islamabad)
INSERT INTO areas (city_id, name) VALUES
(4, 'F-6'),
(4, 'F-7'),
(4, 'G-9'),
(4, 'I-8'),
(4, 'Blue Area');
