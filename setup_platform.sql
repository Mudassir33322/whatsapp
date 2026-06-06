-- 1. Countries Table (New)
CREATE TABLE IF NOT EXISTS countries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code CHAR(2) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Cities Table (New)
CREATE TABLE IF NOT EXISTS cities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    country_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (country_id) REFERENCES countries(id),
    UNIQUE KEY unique_city_country (name, country_id)
);

-- 3. Areas/Neighborhoods Table (New)
CREATE TABLE IF NOT EXISTS areas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    city_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (city_id) REFERENCES cities(id),
    UNIQUE KEY unique_area_city (name, city_id)
);

-- 4. Salons Table (Enhanced with location foreign keys)
CREATE TABLE IF NOT EXISTS salons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    owner_phone VARCHAR(20) UNIQUE NOT NULL,
    country_id INT DEFAULT 1,
    city_id INT DEFAULT 1,
    area_id INT,
    address TEXT,
    description TEXT,
    portfolio_url TEXT,
    cover_image_url VARCHAR(500),
    logo_url VARCHAR(500),
    established_year YEAR,
    rating DECIMAL(3,2) DEFAULT 5.00,
    review_count INT DEFAULT 0,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (country_id) REFERENCES countries(id),
    FOREIGN KEY (city_id) REFERENCES cities(id),
    FOREIGN KEY (area_id) REFERENCES areas(id)
);

-- 5. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255),
    global_points INT DEFAULT 0,
    referral_code VARCHAR(10) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Staff Table
CREATE TABLE IF NOT EXISTS staff (
    id INT AUTO_INCREMENT PRIMARY KEY,
    salon_id INT,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100),
    salary_type ENUM('fixed', 'commission') DEFAULT 'fixed',
    base_salary DECIMAL(10,2) DEFAULT 0,
    commission_rate DECIMAL(5,2) DEFAULT 0,
    FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- 7. Services Table
CREATE TABLE IF NOT EXISTS services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    salon_id INT,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    duration INT DEFAULT 30, -- in minutes
    FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- 8. Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    salon_id INT,
    customer_phone VARCHAR(20),
    service_id INT,
    staff_id INT,
    booking_date DATE,
    booking_time VARCHAR(20),
    status ENUM('pending', 'confirmed', 'cancelled', 'completed') DEFAULT 'pending',
    token VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (salon_id) REFERENCES salons(id),
    FOREIGN KEY (service_id) REFERENCES services(id),
    FOREIGN KEY (staff_id) REFERENCES staff(id)
);

-- 9. Bot States Table (Memory ke liye)
CREATE TABLE IF NOT EXISTS bot_states (
    phone VARCHAR(20) PRIMARY KEY,
    state_data TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 10. Salon Media Gallery Table (New)
CREATE TABLE IF NOT EXISTS salon_media (
    id INT AUTO_INCREMENT PRIMARY KEY,
    salon_id INT NOT NULL,
    media_url VARCHAR(500) NOT NULL,
    media_type ENUM('image', 'video') DEFAULT 'image',
    title VARCHAR(255),
    description TEXT,
    display_order INT DEFAULT 0,
    is_cover BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- 11. Salon Reviews & Ratings Table (New)
CREATE TABLE IF NOT EXISTS salon_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    salon_id INT NOT NULL,
    customer_id INT NOT NULL,
    rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 12. Salon Portfolio/Past Work Table (New)
CREATE TABLE IF NOT EXISTS salon_portfolio (
    id INT AUTO_INCREMENT PRIMARY KEY,
    salon_id INT NOT NULL,
    service_id INT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    media_url VARCHAR(500) NOT NULL,
    media_type ENUM('image', 'video') DEFAULT 'image',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id)
);

-- 13. Revenue Table
CREATE TABLE IF NOT EXISTS revenue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    salon_id INT,
    booking_id INT,
    amount DECIMAL(10,2),
    date DATETIME,
    FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- 14. Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    salon_id INT,
    description TEXT,
    amount DECIMAL(10,2),
    category VARCHAR(100),
    date DATETIME,
    FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- 15. Seats Table
CREATE TABLE IF NOT EXISTS seats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    salon_id INT,
    name VARCHAR(50) NOT NULL,
    status ENUM('Available', 'Occupied') DEFAULT 'Available',
    assigned_staff_id INT,
    FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_staff_id) REFERENCES staff(id) ON DELETE SET NULL
);

-- 16. Working Hours Table
CREATE TABLE IF NOT EXISTS working_hours (
    id INT AUTO_INCREMENT PRIMARY KEY,
    salon_id INT,
    day VARCHAR(20) NOT NULL,
    start_time VARCHAR(10) DEFAULT '09:00',
    end_time VARCHAR(10) DEFAULT '21:00',
    is_open BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- 17. Salaries & Payments Table
CREATE TABLE IF NOT EXISTS salaries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    salon_id INT,
    staff_id INT,
    amount DECIMAL(10,2) NOT NULL,
    type ENUM('Salary', 'Commission', 'Bonus', 'Advance') DEFAULT 'Salary',
    status ENUM('Paid', 'Pending') DEFAULT 'Paid',
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- 18. Shop Settings Table
CREATE TABLE IF NOT EXISTS shop_settings (
    salon_id INT PRIMARY KEY,
    company_name VARCHAR(255),
    currency VARCHAR(10) DEFAULT 'Rs.',
    language VARCHAR(50) DEFAULT 'Urdu/English',
    address TEXT,
    map_url TEXT,
    FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- 19. Products Table
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    salon_id INT,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock INT DEFAULT 0,
    min_stock INT DEFAULT 5,
    unit VARCHAR(20) DEFAULT 'pcs',
    FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- ==========================================
-- INITIALIZE DEFAULT LOCATION DATA
-- ==========================================

-- Insert Pakistan as default country
INSERT IGNORE INTO countries (id, name, code) VALUES 
(1, 'Pakistan', 'PK');

-- Insert Karachi as default city for Pakistan
INSERT IGNORE INTO cities (id, country_id, name) VALUES 
(1, 1, 'Karachi');

-- Insert major Karachi areas
INSERT IGNORE INTO areas (id, city_id, name) VALUES 
(1, 1, 'Saddar'),
(2, 1, 'Clifton'),
(3, 1, 'Defence'),
(4, 1, 'Gulshan-e-Iqbal'),
(5, 1, 'Bahadurabad'),
(6, 1, 'PECHS'),
(7, 1, 'Corporate Area'),
(8, 1, 'Malir'),
(9, 1, 'Landhi'),
(10, 1, 'Orangi Town');

-- ==========================================
-- SAMPLE DATA (Testing ke liye)
-- ==========================================

-- Do Salons add karte hain Karachi ke mukhtalif ilaqon mein
INSERT INTO salons (name, owner_phone, city_id, area_id, address) VALUES 
('AutoZap Defense', '923001111111', 1, 3, 'DHA Phase 6'),
('AutoZap Kemari', '923002222222', 1, 1, 'Main Harbor Road');

-- Services add karte hain (Misaal ke taur par Salon ID 1 ke liye)
INSERT INTO services (salon_id, name, price, duration) VALUES 
(1, 'Premium Haircut', 1500, 45),
(1, 'Royal Beard Trim', 800, 30),
(2, 'Standard Haircut', 1000, 30),
(2, 'Simple Shave', 500, 20);

-- Staff add karte hain
INSERT INTO staff (salon_id, name, role) VALUES 
(1, 'Ahmed Ali', 'Master Barber'),
(2, 'Zubair Khan', 'Junior Stylist');