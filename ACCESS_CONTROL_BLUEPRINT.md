# Access Control Blueprint — AutoZap Enterprise

## 1. Roles Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     SYSTEM ACCESS MAP                        │
├──────────────┬──────────────────┬───────────────────────────┤
│   ADMIN       │   SALON OWNER    │   CUSTOMER / VISITOR      │
│  (Super Admin)│  (Salon Manager) │  (Public)                 │
├──────────────┼──────────────────┼───────────────────────────┤
│  /admin       │  /salon          │  / (main app - login)     │
│  FULL ACCESS  │  OWN SALON ONLY  │  LIMITED                  │
└──────────────┴──────────────────┴───────────────────────────┘
```

---

## 2. Access Matrix — Feature × Role

| # | Feature / Page | ADMIN | SALON OWNER | CUSTOMER |
|---|---------------|-------|-------------|----------|
| | **WHATSAPP** | | | |
| 1 | WhatsApp QR Sync | ✅ | ❌ | ❌ |
| 2 | Live Inbox (Chat) | ✅ | ❌ | ❌ |
| 3 | Bot Automations | ✅ | ❌ | ❌ |
| 4 | WhatsApp Connection Status | ✅ | ❌ | ❌ |
| | **SALON OWNER PORTAL** | | | |
| 5 | Barbers (CRUD + Schedule) | ✅ (all) | ✅ (own) | ❌ |
| 6 | Services (CRUD) | ✅ (all) | ✅ (own) | ❌ |
| 7 | Seats Management | ✅ (all) | ✅ (own) | ❌ |
| 8 | Inventory / Products | ✅ (all) | ✅ (own) | ❌ |
| 9 | Appointments (own salon) | ✅ (all) | ✅ (own) | ❌ |
| 10 | Offers / Promotions | ✅ (all) | ✅ (own) | ❌ |
| 11 | Reviews (own salon) | ✅ (all) | ✅ (own) | ❌ |
| 12 | Customers (own salon) | ✅ (all) | ✅ (own) | ❌ |
| 13 | Analytics (own salon) | ✅ (all) | ✅ (own) | ❌ |
| 14 | Working Hours | ✅ (all) | ✅ (own) | ❌ |
| 15 | Settings (own profile) | ✅ (all) | ✅ (own) | ❌ |
| | **ADMIN PANEL** | | | |
| 16 | Platform Dashboard | ✅ | ❌ | ❌ |
| 17 | All Salons CRUD | ✅ | ❌ | ❌ |
| 18 | Location Management | ✅ | ❌ | ❌ |
| 19 | All Appointments (any salon) | ✅ | ❌ | ❌ |
| 20 | All Customers (any salon) | ✅ | ❌ | ❌ |
| 21 | Platform-wide Analytics | ✅ | ❌ | ❌ |
| | **FINANCE** | | | |
| 22 | Finances & Stock (own) | ✅ (all) | ❌ *(new)* | ❌ |
| 23 | Platform Revenue Overview | ✅ | ❌ | ❌ |
| | **BOOKING** | | | |
| 24 | Booking System (public) | ✅ (manage) | ❌ | ✅ (book) |
| 25 | Customer Booking via WhatsApp | ✅ (view) | ❌ | ✅ (bot) |

---

## 3. Current Problems to Fix

### ❌ Problem 1: Salon Portal has NO Seats, Inventory, CRM
**Fix:** Add 3 new pages to SalonLayout.tsx:
- `SalonSeats` — manage seats/chair positions
- `SalonInventory` — products/stock management
- `SalonCrm` — basic CRM for own customers (tags, notes, visit history)

### ❌ Problem 2: Salon should NOT see WhatsApp features
**Current:** SalonLayout has no WhatsApp features ✅ (good)
**But:** `/api/salon/...` endpoints exist — verify none leak WhatsApp data

### ❌ Problem 3: Admin needs full access to everything
**Current:** AdminLayout has only 3 pages (Dashboard, Locations, Salons)
**Fix:** Add to AdminLayout:
- `AdminWhatsApp` — QR management, connection status
- `AdminInbox` — all chats across all salons
- `AdminAutomations` — bot workflows management
- `AdminAppointments` — all appointments across all salons
- `AdminCustomers` — all customers across all salons
- `AdminFinances` — platform-wide revenue/expenses
- `AdminInventory` — all products across all salons

### ❌ Problem 4: Salon Finances should be in Salon Portal
**Current:** Finances page exists only in User Portal (`/`)
**Fix:** Move salon-level finances to Salon Portal. Admin sees platform-wide finances.

---

## 4. Required Changes Summary

### A) Salon Portal — Add These Pages

| New Page | File to Create | API Endpoint (existing or new) |
|----------|---------------|-------------------------------|
| Seats | `src/salon/SalonSeats.tsx` | `/api/salon/seats` *(exists in db.ts)* |
| Inventory | `src/salon/SalonInventory.tsx` | `/api/salon/products` *(needs new route)* |
| CRM (own) | Already has `SalonCustomers.tsx` ✅ | ✅ already exists |

### B) Admin Portal — Add These Pages

| New Page | File to Create | API Endpoint |
|----------|---------------|-------------|
| WhatsApp QR | `src/admin/AdminWhatsApp.tsx` | `/api/admin/sessions` *(new)* |
| Inbox (all) | `src/admin/AdminInbox.tsx` | `/api/admin/chats` *(new)* |
| Automations | `src/admin/AdminAutomations.tsx` | `/api/admin/automations` *(new)* |
| All Appointments | `src/admin/AdminAppointments.tsx` | `/api/admin/appointments` *(new)* |
| All Customers | `src/admin/AdminCustomers.tsx` | `/api/admin/customers` *(exists)* |
| Finances | `src/admin/AdminFinances.tsx` | `/api/admin/finances` *(new)* |
| Inventory | `src/admin/AdminInventory.tsx` | `/api/admin/products` *(new)* |

### C) Salon API Routes — Add These Endpoints

Add to `salon-routes.ts`:
```
GET/POST/PUT/DELETE  /api/salon/seats        → Seat management
GET/POST/PUT/DELETE  /api/salon/products     → Inventory management
GET                  /api/salon/finances      → Own salon finances summary
```

### D) Admin API Routes — Add These Endpoints

Add to `admin-routes.ts`:
```
GET    /api/admin/sessions         → All WhatsApp sessions
GET    /api/admin/chats            → All chats across all salons
GET    /api/admin/appointments     → All appointments (filterable)
GET    /api/admin/customers        → All customers (already exists)
GET    /api/admin/finances         → Platform-wide finances
GET    /api/admin/products         → All products across all salons
```

---

## 5. Auth Enforcement Rules

```
┌──────────────────────────────────────────────────┐
│              AUTH MIDDLEWARE CHECKS               │
├──────────────┬──────────────────┬─────────────────┤
│  Admin Auth  │  Salon Auth      │  Public          │
│  (adminAuth)  │  (authMiddleware)│  (no auth)       │
├──────────────┼──────────────────┼─────────────────┤
│  role=admin   │  salonId from    │  Read-only       │
│  Full access  │  JWT token       │  Limited data    │
│               │  Scoped to own   │                  │
│               │  salonId only    │                  │
└──────────────┴──────────────────┴─────────────────┘
```

1. **Admin JWT** (`role: 'admin'`) → bypass all salonId scoping
2. **Salon JWT** (`salonId: N`) → all queries filter by `salon_id = N`
3. **No JWT** → public endpoints only (salon listing, booking, reviews)

---

## 6. Implementation Priority

| Priority | Task | Effort |
|----------|------|--------|
| 🔴 P0 | Add Seats page to Salon Portal | 1 day |
| 🔴 P0 | Add Inventory page to Salon Portal | 1 day |
| 🔴 P0 | Add seat + product API routes to salon-routes.ts | 0.5 day |
| 🟡 P1 | Expand Admin Portal with WhatsApp/Inbox/Appointments pages | 3 days |
| 🟡 P1 | Add admin API routes for all-data access | 2 days |
| 🟢 P2 | Move Finances to Salon Portal & create Admin Finances | 1 day |
| 🟢 P2 | Add CRM features to existing SalonCustomers page | 1 day |
