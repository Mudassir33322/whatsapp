# WHATSAPP SALON BOOKING APP — COMPLETE BLUEPRINT

## VISION
Ek WhatsApp-based salon booking application jahan user WhatsApp pe message bhej kar apne area ke salons, barbers, aur services dekh sake, booking kare, confirmation paaye, aur review de.

---

## SYSTEM ARCHITECTURE

```
User (WhatsApp) ←→ WhatsApp Bot (Baileys) ←→ Express Server ←→ MySQL DB
                                                ↑
                                        Admin Portal (Web)
                                                ↑
                                        Salon Owner Portal (Web)
```

---

## DATABASE SCHEMA

### 1. countries
| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| name | VARCHAR(100) | Pakistan, India, etc. |
| is_active | BOOLEAN | Default TRUE |

### 2. cities
| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| country_id | INT FK | |
| name | VARCHAR(100) | Karachi, Lahore, Hyderabad |
| is_active | BOOLEAN | |

### 3. areas
| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| city_id | INT FK | |
| name | VARCHAR(100) | Liyari, DHA, Gulshan |
| is_active | BOOLEAN | |

### 4. salons
| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| name | VARCHAR(255) | |
| owner_name | VARCHAR(255) | |
| phone | VARCHAR(20) | |
| email | VARCHAR(255) | Login email |
| password | VARCHAR(255) | Hashed password |
| country_id | INT FK | |
| city_id | INT FK | |
| area_id | INT FK | |
| address | TEXT | |
| latitude | DECIMAL | |
| longitude | DECIMAL | |
| cover_image | VARCHAR(500) | |
| logo | VARCHAR(500) | |
| description | TEXT | |
| rating | DECIMAL(2,1) | Avg rating |
| review_count | INT | |
| status | ENUM(active,inactive,pending) | |
| created_at | TIMESTAMP | |

### 5. salon_media
| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| salon_id | INT FK | |
| media_url | VARCHAR(500) | |
| media_type | ENUM(image,video) | |
| title | VARCHAR(255) | |
| is_cover | BOOLEAN | |

### 6. barbers
| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| salon_id | INT FK | |
| name | VARCHAR(255) | |
| phone | VARCHAR(20) | |
| bio | TEXT | |
| experience | INT | Years |
| profile_image | VARCHAR(500) | |
| specialization | VARCHAR(255) | |
| rating | DECIMAL(2,1) | |
| review_count | INT | |
| status | ENUM(active,inactive) | |
| created_at | TIMESTAMP | |

### 7. barber_portfolio
| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| barber_id | INT FK | |
| media_url | VARCHAR(500) | |
| media_type | ENUM(image,video) | |
| title | VARCHAR(255) | |
| created_at | TIMESTAMP | |

### 8. services
| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| salon_id | INT FK | |
| name | VARCHAR(255) | Haircut, Beard Trim, etc. |
| description | TEXT | |
| price | DECIMAL(10,2) | |
| duration | INT | Minutes |
| category | VARCHAR(100) | |
| is_active | BOOLEAN | |

### 9. barber_services
| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| barber_id | INT FK | |
| service_id | INT FK | |
| price | DECIMAL(10,2) | Optional different price |

### 10. appointments
| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| salon_id | INT FK | |
| barber_id | INT FK | |
| customer_phone | VARCHAR(20) | |
| customer_name | VARCHAR(255) | |
| service_id | INT FK | |
| appointment_date | DATE | |
| appointment_time | TIME | |
| end_time | TIME | |
| status | ENUM(pending,confirmed,completed,cancelled,no_show) | |
| token | VARCHAR(10) | Unique booking token |
| notes | TEXT | |
| created_at | TIMESTAMP | |

### 11. working_hours
| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| salon_id | INT FK | |
| day_of_week | INT(0-6) | 0=Sunday |
| start_time | TIME | |
| end_time | TIME | |
| is_off | BOOLEAN | |

### 12. barber_schedule
| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| barber_id | INT FK | |
| day_of_week | INT(0-6) | |
| start_time | TIME | |
| end_time | TIME | |
| slot_duration | INT | Minutes (default 30) |
| is_available | BOOLEAN | |

### 13. reviews
| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| salon_id | INT FK | |
| barber_id | INT FK NULL | |
| customer_phone | VARCHAR(20) | |
| rating | INT(1-5) | |
| comment | TEXT | |
| created_at | TIMESTAMP | |

### 14. offers
| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| salon_id | INT FK | |
| title | VARCHAR(255) | |
| description | TEXT | |
| discount_percent | INT | |
| valid_from | DATE | |
| valid_until | DATE | |
| is_active | BOOLEAN | |

### 15. products
| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| salon_id | INT FK | |
| name | VARCHAR(255) | |
| price | DECIMAL(10,2) | |
| stock | INT | |
| unit | VARCHAR(50) | |
| description | TEXT | |
| image_url | VARCHAR(500) | |

---

## WHATSAPP BOT FLOW

### Step-by-step Conversation

```
User: "Hello"
Bot: 👋 Welcome to SalonLink Pakistan!
     Apne city select karein:
     1️⃣ Karachi
     2️⃣ Lahore
     3️⃣ Hyderabad
     4️⃣ Islamabad

User: "1"
Bot: Karachi ke areas:
     1️⃣ Liyari
     2️⃣ DHA
     3️⃣ Gulshan
     4️⃣ Clifton
     
User: "1"
Bot: 🏠 Liyari ke Salons:
     1️⃣ ⭐4.5 Prime Cuts - 0.5km
     2️⃣ ⭐4.2 Style Studio - 1.2km
     3️⃣ ⭐3.8 Barber King - 0.8km

User: "1"
Bot: 🏠 *Prime Cuts*
     ⭐ Rating: 4.5
     📍 Liyari, Main Road
     📞 0300-1234567
     
     👨‍🦱 Barbers:
     1️⃣ Ali (5yr exp) ⭐4.7
     2️⃣ Usman (3yr exp) ⭐4.5
     3️⃣ Bilal (7yr exp) ⭐4.9
     
     ✂️ Services:
     4️⃣ Haircut - Rs.300
     5️⃣ Beard Trim - Rs.150
     6️⃣ Full Package - Rs.500
     
     7️⃣ 📸 Photos
     8️⃣ 🔖 Offers
     9️⃣ ⭐ Reviews
     
User: "1" (Barber Ali)
Bot: 👨‍🦱 *Ali*
     5 years experience
     ⭐ 4.7 rating
     Specializes in: Fade Cuts, Beard Styling
     
     📸 Portfolio: [images]
     
     Available slots today:
     1️⃣ 10:00 AM
     2️⃣ 10:30 AM
     3️⃣ 11:00 AM
     4️⃣ 2:00 PM
     5️⃣ 3:30 PM

User: "1"
Bot: Service select karein:
     1️⃣ Haircut - Rs.300
     2️⃣ Beard Trim - Rs.150
     3️⃣ Full Package - Rs.500

User: "1"
Bot: ✅ *Booking Confirmed!*
     Token: #A7K2
     Salon: Prime Cuts
     Barber: Ali
     Service: Haircut - Rs.300
     Time: Today, 10:00 AM
     
     Reminder bhejenge 30 min pehle.
     Cancel karne ke liye: CANCEL A7K2

--- 30 min before appointment ---
Bot: ⏰ *Reminder!*
     Aapki appointment 30 min mein hai:
     Prime Cuts | Ali | 10:00 AM
     Token: #A7K2

--- After appointment ---
Bot: ⭐ Apne experience ko rate karein:
     1️⃣ ⭐
     2️⃣ ⭐⭐
     3️⃣ ⭐⭐⭐
     4️⃣ ⭐⭐⭐⭐
     5️⃣ ⭐⭐⭐⭐⭐

User: "5"
Bot: Shukriya! Koi comments dena chahenge?

User: "Bohot acha experience"
Bot: 🎉 Thank you! Aapko 30 loyalty points mile!
     Total Points: 150 | Tier: Silver
```

---

## SALON OWNER PORTAL

### Login
- Email + Password based login
- Each salon gets unique credentials

### Dashboard
- Today's appointments
- Total customers
- Revenue today/this week
- Pending/cancelled/completed bookings count
- Quick actions

### Features
1. **Profile Management**
   - Edit salon name, address, description
   - Upload logo, cover image
   - Update contact info

2. **Barber Management**
   - Add/remove barbers
   - Edit barber profiles (name, bio, experience, photo)
   - Upload barber portfolio images
   - Activate/deactivate barbers
   - Manage barber schedules (working days, timings)

3. **Service Management**
   - Add/remove services
   - Set price and duration
   - Categorize services
   - Activate/deactivate services

4. **Appointment Management**
   - View all appointments (today/upcoming/past)
   - Confirm/cancel appointments
   - Mark as completed
   - View customer history

5. **Time Management**
   - Set working hours per day
   - Set slot duration (15/30/45/60 min)
   - Block specific time slots
   - Manage holidays

6. **Inventory/Products** *(optional)*
   - Add/remove products
   - Update stock
   - Set prices

7. **Offers & Promotions**
   - Create offers
   - Set discount percentage
   - Set validity dates
   - Activate/deactivate

8. **Reviews**
   - View all reviews
   - Respond to reviews

9. **Analytics**
   - Total appointments
   - Revenue reports
   - Popular services
   - Top barbers

---

## ADMIN PANEL

### Features
1. **Salon Management**
   - Add new salons (create login credentials)
   - Approve/reject salon requests
   - Activate/deactivate salons
   - View all salons

2. **Location Management**
   - Add countries, cities, areas
   - Manage hierarchical location data

3. **User Management**
   - View all customers
   - View salon owners

4. **System Oversight**
   - Platform stats
   - Revenue overview
   - Activity logs

---

## BUILD PLAN (Phase-wise)

### PHASE 1 — Database Setup
- [ ] Create all tables from schema above
- [ ] Seed countries (Pakistan), cities (Karachi, Lahore, Hyderabad, Islamabad), areas
- [ ] Create initial salons with admin credentials

### PHASE 2 — WhatsApp Bot (Baileys)
- [ ] Session management (connect/disconnect)
- [ ] Welcome message handler
- [ ] City → Area → Salon selection flow
- [ ] Barber listing with profiles
- [ ] Service listing
- [ ] Slot selection (based on working hours + existing bookings)
- [ ] Booking confirmation + token generation
- [ ] Reminder system (30 min before)
- [ ] Post-service review flow
- [ ] Loyalty points system
- [ ] Referral system

### PHASE 3 — Salon Owner Portal
- [ ] Login system (email + password, JWT)
- [ ] Dashboard with stats
- [ ] Barber CRUD
- [ ] Service CRUD
- [ ] Appointment management
- [ ] Time/schedule management
- [ ] Offer management
- [ ] Review viewing

### PHASE 4 — Admin Panel
- [ ] Location management (CRUD countries, cities, areas)
- [ ] Salon CRUD (create with login credentials)
- [ ] Platform monitoring

### PHASE 5 — Notifications & Reminders
- [ ] Booking confirmation WhatsApp message
- [ ] 30-min reminder WhatsApp message
- [ ] Post-service review request
- [ ] Cancellation notifications

---

## TECH STACK

| Layer | Technology | Reason |
|-------|------------|--------|
| WhatsApp | Baileys (WhatsApp Web JS) | Already in use |
| Backend | Node.js + Express | Already in use |
| Frontend | React + Vite | Already in use |
| Database | MySQL | Already in use |
| Real-time | Socket.IO | Already in use |
| Auth | JWT (jsonwebtoken) | Easy to implement |
| Styling | Tailwind CSS | Already in use |

---

## CURRENT AUTOZAP -> NEW SYSTEM MIGRATION

Jo kuch AutoZap mein pehle se hai:

| Feature | Reuse? | Action |
|---------|--------|--------|
| WhatsApp connection | ✅ | Reuse Baileys setup |
| Location schema | ✅ | Enhance with countries/cities/areas |
| Salon CRUD | ✅ | Add owner portal fields |
| Services CRUD | ✅ | Minor enhancements |
| Booking system | ✅ | Add time slot logic |
| Loyalty points | ✅ | Already implemented |
| Bot conversation | ⚠️ | Major rewrite needed |
| Frontend Dashboard | ✅ | Convert to Salon Owner Portal |
| Finance/Stock | ❌ | Skip for now |

---

## NEXT STEPS (Immediate Actions)

1. Database migration — Create new tables
2. Rewrite bot.ts — New conversation flow
3. Build Salon Owner Portal (React components)
4. Time slot management system
5. Notification/Reminder engine
