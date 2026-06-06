# FINAL PLAN — WhatsApp Salon Booking System

## SYSTEM OVERVIEW
```
User (WhatsApp) → Bot → Booking → Confirm → Reminder → Service → Review → Points
                      ↑                        ↑
                Salon Owner Portal      Admin Panel
                (Web Login)             (Web Login)
```

---

## PHASE 1: DATABASE — 15 TABLES

### Order of Creation
```
1. countries          → Pakistan
2. cities             → Karachi, Lahore, Hyderabad, Islamabad
3. areas              → Liyari, DHA, Gulshan, Clifton, etc.
4. salons             → Name, owner, email/password, location, status
5. salon_media        → Photos/videos
6. working_hours      → Per day timing
7. barbers            → Name, bio, experience, specialization, image
8. barber_portfolio   → Work samples
9. barber_schedule    → Per day schedule + slot duration
10. services          → Name, price, duration, category
11. barber_services   → Link barber to services (different prices possible)
12. appointments      → Booking with UNIQUE(barber, date, time) — NO DOUBLE BOOK
13. reviews           → Rating 1-5 + comment
14. offers            → Discount, validity
15. customers         → Phone, name, total visits, points
```

---

## PHASE 2: WHATSAPP BOT FLOW

### Conversation Steps
```
Hello → Welcome Menu
  → 1: Book Appointment
       → Country → City → Area → Salon List
       → Barber List → Barber Detail (profile + portfolio pics)
       → Service Selection (with price + duration)
       → Smart Time Slots (working hours - existing bookings - current busy)
       → Confirm Booking ✅ → Token #A7K2
  → 2: My Profile
       → Points, history, tier
  → 3: Refer a Friend
       → Share referral code

After Booking:
  → Confirmation message (token, time, barber, salon)
  → 30 min reminder ⏰
  → Post-service: Review request ⭐
  → Points earned notification 🎉

Commands:
  CANCEL A7K2 → Cancel booking
  QUEUE A7K2  → Check queue position
  HELP        → Show all commands
```

### SMART SLOT ENGINE — Core Logic
```
function getAvailableSlots(barberId, date) {
    // 1. Get working hours for that day
    workingHours = getBarberSchedule(barberId, date)
    
    // 2. Get ALL existing bookings for that day
    existingBookings = getAppointments(barberId, date)
    
    // 3. Get current in-progress appointment
    currentAppt = getCurrentAppointment(barberId)
    
    // 4. Generate slots from working hours
    allSlots = generateTimeSlots(workingHours, slotDuration=30, buffer=5)
    
    // 5. REMOVE already booked slots
    availableSlots = allSlots - existingBookings
    
    // 6. If barber busy NOW → remove slots before currentAppt.end_time + buffer
    if (currentAppt) {
        availableSlots = availableSlots.filter(slot => 
            slot.start_time >= currentAppt.end_time + buffer
        )
    }
    
    // 7. REMOVE past slots (current time se pehle)
    availableSlots = availableSlots.filter(slot => slot.start_time > NOW)
    
    return availableSlots
}
```

---

## PHASE 3: SALON OWNER PORTAL — 11 MODULES

### 3.1 Login
- Email + password
- JWT token
- Forgot password

### 3.2 Dashboard
- Today's bookings count
- Revenue today
- Pending/completed/cancelled
- Today's schedule table
- Quick actions (confirm/complete)

### 3.3 Barber Management (CRUD)
- Add barber: name, phone, email, bio, experience, specialization, image
- Edit/delete barber
- Upload portfolio images (work samples)
- Barber schedule per day (Mon-Sun, timings)
- Slot duration setting

### 3.4 Service Management (CRUD)
- Add service: name, description, price, duration, category
- Edit/delete service
- Link services to specific barbers

### 3.5 Appointment Management
- View all appointments (filter by date/barber/status)
- Confirm pending
- Mark "In Progress" → barber busy ho jaye
- Mark "Completed" → barber free
- Cancel with reason
- View customer history

### 3.6 Working Hours
- Set open/close per day
- Buffer time between slots (5/10/15 min)
- Block dates (holidays)

### 3.7 Offers
- Create: title, discount%, valid from/to
- Activate/deactivate
- Delete

### 3.8 Reviews
- View all (rating + comment + customer name)
- Reply to reviews

### 3.9 Customer List
- All customers with phone, visits, total spent
- Search by name/phone
- Customer history

### 3.10 Analytics
- Revenue chart (7d/30d/1y)
- Bookings chart
- Top services pie chart
- Top barbers ranking
- Peak hours analysis
- Export CSV/PDF

### 3.11 Settings
- Edit salon profile (name, address, images, description)
- Change password
- Notification preferences

---

## PHASE 4: ADMIN PANEL — 3 MODULES

### 4.1 Location Management
- Countries: Add/Edit/Delete
- Cities: Add/Edit/Delete (per country)
- Areas: Add/Edit/Delete (per city)

### 4.2 Salon Management
- Add salon (auto create login credentials)
- Edit/delete salon
- Activate/deactivate
- Reset password
- View all salons

### 4.3 Overview
- Platform stats: total users, salons, bookings

---

## PHASE 5: NOTIFICATIONS (AUTO)

| Timing | Message | Channel |
|--------|---------|---------|
| Booking done | ✅ Confirmation with token | WhatsApp |
| 30 min before | ⏰ Reminder | WhatsApp |
| After 2 in queue | 📋 Your turn is coming | WhatsApp |
| Service done | ⭐ Rate your experience | WhatsApp |
| After review | 🎉 Points earned | WhatsApp |
| 30 days idle | 💈 "Book again" offer | WhatsApp |

---

## PHASE 6: ENHANCEMENTS (PRIORITY ORDER)

### HIGH Priority (Implement after core is stable)
- [ ] **Buffer time** between appointments (configurable)
- [ ] **Real-time barber status** (Available/Busy/OnBreak)
- [ ] **Reschedule booking** (user change date/time)
- [ ] **Re-book** — 1 click repeat last booking
- [ ] **Favourite barber** — quick book

### MEDIUM Priority
- [ ] **Multi-language** — WhatsApp Urdu + English
- [ ] **Multiple services** — One booking, multiple services
- [ ] **Waitlist** — No slot? Join waitlist, auto-notify
- [ ] **Urgent booking** — Pay extra for priority
- [ ] **Recurring booking** — Every Monday 10AM
- [ ] **Barber switch** — If busy, suggest another
- [ ] **Walk-in add** — Salon owner manual entry
- [ ] **Multi-branch** — One owner, multiple salons

### LOW Priority (Future)
- [ ] **Payment** — JazzCash/EasyPaisa
- [ ] **Voice booking** — Voice note → booking
- [ ] **Gift cards** — Gift service to others
- [ ] **QR check-in** — Scan at salon
- [ ] **Google Calendar sync**
- [ ] **POS integration** — Thermal printer
- [ ] **Smart pricing** — Peak/off-peak
- [ ] **SMS fallback**
- [ ] **Video tour**
- [ ] **Product e-commerce**
- [ ] **Staff attendance**
- [ ] **Expense tracking**
- [ ] **Tax reports**

---

## COMPLETE TODO LIST

### 🟢 PHASE 1: DATABASE
```
[ ] 1.1 Create countries table + seed Pakistan
[ ] 1.2 Create cities table + seed Karachi, Lahore, Hyderabad, Islamabad
[ ] 1.3 Create areas table + seed areas for each city
[ ] 1.4 Create salons table (with email/password for portal login)
[ ] 1.5 Create salon_media table
[ ] 1.6 Create working_hours table
[ ] 1.7 Create barbers table
[ ] 1.8 Create barber_portfolio table
[ ] 1.9 Create barber_schedule table
[ ] 1.10 Create services table
[ ] 1.11 Create barber_services table
[ ] 1.12 Create appointments table + UNIQUE constraint
[ ] 1.13 Create reviews table
[ ] 1.14 Create offers table
[ ] 1.15 Create customers table
[ ] 1.16 Add 2-3 demo salons with barbers, services
```

### 🟢 PHASE 2: WHATSAPP BOT
```
[ ] 2.1 Welcome menu (Hello → options)
[ ] 2.2 Country selection flow
[ ] 2.3 City selection flow (filtered by country)
[ ] 2.4 Area selection flow (filtered by city)
[ ] 2.5 Salon listing + detail view
[ ] 2.6 Barber listing + profile + portfolio
[ ] 2.7 Service listing with prices
[ ] 2.8 SMART SLOT ENGINE (working hours - bookings - current busy)
[ ] 2.9 Booking confirmation + token generation
[ ] 2.10 Booking cancellation (CANCEL TOKEN)
[ ] 2.11 Queue check (QUEUE TOKEN)
[ ] 2.12 User profile (points, history)
[ ] 2.13 Referral system
```

### 🟢 PHASE 3: SALON PORTAL — BACKEND API
```
[ ] 3.1 JWT auth (login, token, refresh)
[ ] 3.2 Dashboard API (stats, today's schedule)
[ ] 3.3 Barber CRUD API
[ ] 3.4 Barber portfolio upload API
[ ] 3.5 Barber schedule API
[ ] 3.6 Service CRUD API
[ ] 3.7 Barber-service linking API
[ ] 3.8 Appointment management API
[ ] 3.9 Working hours API
[ ] 3.10 Offers CRUD API
[ ] 3.11 Reviews API
[ ] 3.12 Customers list API
[ ] 3.13 Analytics API
[ ] 3.14 Settings API
```

### 🟢 PHASE 4: SALON PORTAL — FRONTEND (React)
```
[ ] 4.1 Login page
[ ] 4.2 Dashboard page (stats + schedule)
[ ] 4.3 Barber management page (table + add/edit form)
[ ] 4.4 Barber portfolio upload
[ ] 4.5 Barber schedule editor
[ ] 4.6 Service management page
[ ] 4.7 Appointment management page
[ ] 4.8 Working hours settings page
[ ] 4.9 Offers management page
[ ] 4.10 Reviews page
[ ] 4.11 Customer list page
[ ] 4.12 Analytics page (charts)
[ ] 4.13 Settings page
```

### 🟢 PHASE 5: ADMIN PANEL
```
[ ] 5.1 Admin login
[ ] 5.2 Country/City/Area CRUD
[ ] 5.3 Salon management (add with credentials)
[ ] 5.4 Platform overview stats
```

### 🟢 PHASE 6: NOTIFICATIONS
```
[ ] 6.1 Booking confirmation message
[ ] 6.2 30-min reminder (cron job or setTimeout)
[ ] 6.3 Post-service review request
[ ] 6.4 Points earned notification
[ ] 6.5 Re-engagement message (30 days idle)
```

---

## TIMELINE ESTIMATE

| Phase | Days |
|-------|------|
| Phase 1: Database | 2 |
| Phase 2: WhatsApp Bot | 5 |
| Phase 3: Backend API | 5 |
| Phase 4: Frontend (Salon Portal) | 7 |
| Phase 5: Admin Panel | 2 |
| Phase 6: Notifications | 2 |
| Testing + Deployment | 3 |
| **TOTAL** | **~26 days** |

---

## TECH STACK (SAME RAHEGA)

| Layer | Technology |
|-------|-----------|
| WhatsApp | Baileys (already setup) |
| Backend | Node.js + Express (already setup) |
| Frontend | React + Vite + Tailwind (already setup) |
| Database | MySQL (already setup) |
| Auth | JWT (jsonwebtoken) |
| Real-time | Socket.IO (already setup) |

---

## NOTES

1. **Double Booking Prevent** — UNIQUE KEY on (barber_id, date, time) + backend check
2. **Smart Slots** — Dynamic calculation based on: working hours - existing bookings - current busy + buffer
3. **Buffer Time** — Default 5 min between appointments
4. **Token Format** — #A7K2 (6 char alphanumeric)
5. **Finance/Stock** — Side rakha hai, baad mein implement karenge
