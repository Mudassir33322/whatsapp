-- =============================================================
-- SEED DEMO DATA
-- =============================================================

-- DEMO SALONS
INSERT INTO salons (id, name, owner_name, phone, email, password, country_id, city_id, area_id, address, description, rating, review_count, status)
VALUES
(1, 'Prime Cuts Studio', 'Ali Khan', '0300-1111111', 'primecuts@salon.com', '$2b$10$UCLWc7r2V25N6oIur4O4/u6hoGzWRCaEU9hldRbWuuJJiiJ4UB.kK', 1, 1, 1, 'Main Liyari Road, Near Al-Falah Hospital', 'Best grooming experience in Liyari. Professional barbers with 5+ years experience.', 4.5, 128, 'active'),
(2, 'Style King Salon', 'Usman Ahmed', '0300-2222222', 'styleking@salon.com', '$2b$10$UCLWc7r2V25N6oIur4O4/u6hoGzWRCaEU9hldRbWuuJJiiJ4UB.kK', 1, 1, 3, 'Gulshan Chowrangi, Block 5', 'Premium salon in Gulshan. Modern haircuts and styling.', 4.2, 85, 'active'),
(3, 'Royal Barber Hub', 'Bilal Hussain', '0300-3333333', 'royalhub@salon.com', '$2b$10$UCLWc7r2V25N6oIur4O4/u6hoGzWRCaEU9hldRbWuuJJiiJ4UB.kK', 1, 2, 11, 'Gulberg Main Boulevard', 'Luxury grooming experience in Lahore.', 4.8, 210, 'active');

-- WORKING HOURS (Prime Cuts - Liyari)
INSERT INTO working_hours (salon_id, day_of_week, start_time, end_time, is_off) VALUES
(1, 0, '14:00', '22:00', FALSE),   -- Sunday
(1, 1, '09:00', '23:00', FALSE),   -- Monday
(1, 2, '09:00', '23:00', FALSE),   -- Tuesday
(1, 3, '09:00', '23:00', FALSE),   -- Wednesday
(1, 4, '09:00', '23:00', FALSE),   -- Thursday
(1, 5, '14:00', '23:00', FALSE),   -- Friday (Jumma break)
(1, 6, '10:00', '23:00', FALSE);   -- Saturday

-- WORKING HOURS (Style King - Gulshan)
INSERT INTO working_hours (salon_id, day_of_week, start_time, end_time, is_off) VALUES
(2, 0, '13:00', '22:00', FALSE),
(2, 1, '10:00', '22:00', FALSE),
(2, 2, '10:00', '22:00', FALSE),
(2, 3, '10:00', '22:00', FALSE),
(2, 4, '10:00', '22:00', FALSE),
(2, 5, '15:00', '23:00', FALSE),
(2, 6, '10:00', '23:00', FALSE);

-- WORKING HOURS (Royal Barber Hub - Lahore)
INSERT INTO working_hours (salon_id, day_of_week, start_time, end_time, is_off) VALUES
(3, 0, '12:00', '22:00', FALSE),
(3, 1, '09:00', '22:00', FALSE),
(3, 2, '09:00', '22:00', FALSE),
(3, 3, '09:00', '22:00', FALSE),
(3, 4, '09:00', '22:00', FALSE),
(3, 5, '14:00', '23:00', FALSE),
(3, 6, '10:00', '23:00', FALSE);

-- BARBERS (Prime Cuts)
INSERT INTO barbers (id, salon_id, name, phone, bio, experience, specialization, rating, review_count, status)
VALUES
(1, 1, 'Ali', '0301-1111111', 'Expert in fade cuts and modern styling. 5 years of professional experience.', 5, 'Fade Cuts, Beard Styling', 4.7, 52, 'active'),
(2, 1, 'Usman', '0301-1111112', 'Specialist in classic cuts and hair coloring. Very patient with customers.', 3, 'Classic Cuts, Hair Color', 4.5, 38, 'active'),
(3, 1, 'Bilal', '0301-1111113', 'Master barber with 7 years experience. Royal shave specialist.', 7, 'Royal Shave, Traditional Cuts', 4.9, 71, 'active');

-- BARBERS (Style King)
INSERT INTO barbers (id, salon_id, name, phone, bio, experience, specialization, rating, review_count, status)
VALUES
(4, 2, 'Rizwan', '0302-2222221', 'Modern hairstyles expert. Known for precision cuts.', 4, 'Modern Cuts, Pompadour', 4.3, 45, 'active'),
(5, 2, 'Farhan', '0302-2222222', 'Beard grooming specialist. Hot towel shave expert.', 6, 'Beard Grooming, Hot Shave', 4.6, 33, 'active');

-- BARBERS (Royal Barber Hub)
INSERT INTO barbers (id, salon_id, name, phone, bio, experience, specialization, rating, review_count, status)
VALUES
(6, 3, 'Kamran', '0303-3333331', 'Luxury grooming expert. Trained in Dubai.', 8, 'Luxury Cuts, Styling', 4.9, 95, 'active'),
(7, 3, 'Shahid', '0303-3333332', 'Specialist in beard and mustache styling.', 4, 'Beard Styling, Trims', 4.7, 62, 'active');

-- BARBER SCHEDULES (Ali - Mon to Sat, 9AM-9PM)
INSERT INTO barber_schedule (barber_id, day_of_week, start_time, end_time, slot_duration, is_available) VALUES
(1, 1, '09:00', '21:00', 30, TRUE),
(1, 2, '09:00', '21:00', 30, TRUE),
(1, 3, '09:00', '21:00', 30, TRUE),
(1, 4, '09:00', '21:00', 30, TRUE),
(1, 5, '14:00', '21:00', 30, TRUE),
(1, 6, '10:00', '21:00', 30, TRUE);

-- BARBER SCHEDULES (Usman - same)
INSERT INTO barber_schedule (barber_id, day_of_week, start_time, end_time, slot_duration, is_available) VALUES
(2, 1, '10:00', '21:00', 30, TRUE),
(2, 2, '10:00', '21:00', 30, TRUE),
(2, 3, '10:00', '21:00', 30, TRUE),
(2, 4, '10:00', '21:00', 30, TRUE),
(2, 5, '14:00', '21:00', 30, TRUE),
(2, 6, '10:00', '21:00', 30, TRUE);

-- BARBER SCHEDULES (Bilal)
INSERT INTO barber_schedule (barber_id, day_of_week, start_time, end_time, slot_duration, is_available) VALUES
(3, 1, '09:00', '21:00', 45, TRUE),
(3, 2, '09:00', '21:00', 45, TRUE),
(3, 3, '09:00', '21:00', 45, TRUE),
(3, 4, '09:00', '21:00', 45, TRUE),
(3, 5, '14:00', '21:00', 45, TRUE),
(3, 6, '10:00', '21:00', 45, TRUE);

-- SERVICES (Prime Cuts)
INSERT INTO services (id, salon_id, name, description, price, duration, category, is_active) VALUES
(1, 1, 'Haircut', 'Professional haircut with styling', 300, 30, 'Hair', TRUE),
(2, 1, 'Beard Trim', 'Precision beard trimming and shaping', 150, 15, 'Beard', TRUE),
(3, 1, 'Haircut + Beard', 'Complete grooming package', 400, 45, 'Combo', TRUE),
(4, 1, 'Royal Shave', 'Hot towel shave with premium products', 250, 20, 'Shave', TRUE),
(5, 1, 'Hair Color', 'Professional hair coloring', 800, 60, 'Color', TRUE),
(6, 1, 'Full Package', 'Haircut + Beard + Shave + Face wash', 1000, 90, 'Combo', TRUE);

-- SERVICES (Style King)
INSERT INTO services (id, salon_id, name, description, price, duration, category, is_active) VALUES
(7, 2, 'Haircut', 'Modern haircut and styling', 350, 30, 'Hair', TRUE),
(8, 2, 'Beard Trim', 'Beard shaping and grooming', 200, 15, 'Beard', TRUE),
(9, 2, 'Pompadour Style', 'Special pompadour hairstyle', 500, 45, 'Styling', TRUE),
(10, 2, 'Hot Towel Shave', 'Luxury hot towel shave experience', 400, 30, 'Shave', TRUE),
(11, 2, 'Hair Color + Cut', 'Color and haircut combo', 1200, 75, 'Combo', TRUE);

-- SERVICES (Royal Barber Hub)
INSERT INTO services (id, salon_id, name, description, price, duration, category, is_active) VALUES
(12, 3, 'Executive Haircut', 'Premium haircut with head massage', 500, 40, 'Hair', TRUE),
(13, 3, 'Luxury Beard Grooming', 'Premium beard treatment', 350, 25, 'Beard', TRUE),
(14, 3, 'Royal Package', 'Haircut + Beard + Facial + Head Massage', 1500, 120, 'Combo', TRUE),
(15, 3, 'Hair Spa', 'Deep conditioning hair spa treatment', 1000, 60, 'Spa', TRUE);

-- BARBER SERVICES (Ali → all services)
INSERT INTO barber_services (barber_id, service_id) VALUES (1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6);
-- BARBER SERVICES (Usman → haircut, beard, color)
INSERT INTO barber_services (barber_id, service_id) VALUES (2, 1), (2, 2), (2, 3), (2, 5);
-- BARBER SERVICES (Bilal → haircut, beard, shave, full package)
INSERT INTO barber_services (barber_id, service_id) VALUES (3, 1), (3, 2), (3, 3), (3, 4), (3, 6);
-- BARBER SERVICES (Rizwan → Style King services)
INSERT INTO barber_services (barber_id, service_id) VALUES (4, 7), (4, 8), (4, 9), (4, 11);
-- BARBER SERVICES (Farhan → Style King)
INSERT INTO barber_services (barber_id, service_id) VALUES (5, 8), (5, 10);
-- BARBER SERVICES (Kamran → Royal Hub)
INSERT INTO barber_services (barber_id, service_id) VALUES (6, 12), (6, 13), (6, 14), (6, 15);
-- BARBER SERVICES (Shahid → Royal Hub)
INSERT INTO barber_services (barber_id, service_id) VALUES (7, 12), (7, 13);

-- DEMO OFFERS
INSERT INTO offers (salon_id, title, description, discount_percent, valid_from, valid_until, is_active) VALUES
(1, 'Summer Special', '20% off on all services this summer!', 20, '2026-06-01', '2026-06-30', TRUE),
(1, 'First Time Offer', 'New customers get 15% off on first haircut', 15, '2026-01-01', '2026-12-31', TRUE),
(2, 'Weekend Special', '10% off on every service on weekends', 10, '2026-01-01', '2026-12-31', TRUE),
(3, 'Royal Welcome', '30% off on Royal Package for first time', 30, '2026-06-01', '2026-07-15', TRUE);
