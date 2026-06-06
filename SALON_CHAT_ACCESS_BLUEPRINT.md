# Salon Chat & Customer Status Access Blueprint — AutoZap Enterprise

## 1. Vision

Salon owners ko unke salon se visit/book karne wale customers ki chat aur status dekhne ka access dena. Super Admin ko sab kuch dekhne ka full access rahega.

---

## 2. Access Matrix

| Feature | Super Admin | Salon Owner | Customer |
|---------|-------------|-------------|----------|
| All Chats (Inbox) | ✅ Full | ❌ Currently | ❌ |
| Own Salon Customer Chats | ✅ | ✅ **New** | ❌ |
| Customer Status (0/1/2) | ✅ All | ✅ Own Only | ❌ |
| Booking Details | ✅ All | ✅ Own | ✅ Own |
| Send WhatsApp Msg to Customer | ✅ All | ✅ Own Only | ❌ |

---

## 3. Customer Status System (0/1/2)

```
0 = New (first time interacted)
1 = Active (visited/booked in last 30 days)
2 = Inactive (no visit/booking in 30+ days)
```

### Auto-Update Rules:
- **0 → 1**: When customer sends first message or books first appointment
- **1 → 2**: When no booking/visit for 30 days
- **2 → 1**: When customer books again or visits

### Status Column in DB:
```sql
ALTER TABLE customers ADD COLUMN status TINYINT(1) DEFAULT 0;
ALTER TABLE customers ADD COLUMN last_active DATE DEFAULT NULL;
```

---

## 4. API Endpoints

### New Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/salon/customers` | Salon | Get salon's customers with status |
| GET | `/api/salon/customers/:id/chats` | Salon | Get chat history for a customer |
| GET | `/api/salon/customers/:id/bookings` | Salon | Get booking history for a customer |
| POST | `/api/salon/customers/:id/message` | Salon | Send WhatsApp message to customer |
| GET | `/api/admin/customers` | Admin | Get all customers across all salons |
| GET | `/api/admin/customers/:id/chats` | Admin | Get any customer's chat |
| GET | `/api/admin/customers/:id/bookings` | Admin | Get any customer's booking |

### Existing Endpoints to Modify

| Method | Route | Change |
|--------|-------|--------|
| GET | `/api/admin/inbox` | Add `salon_id` filter for salon owners |
| GET | `/api/admin/customers` | Add salon filter for salon owners |

---

## 5. Frontend Changes

### Salon Portal - New "Customers" Tab
```
Salon Dashboard
├── Dashboard (stats)
├── Appointments
├── Barbers
├── Services
├── **Customers** ← NEW
│   ├── Customer List (with status badges)
│   ├── Customer Detail
│   │   ├── Profile Info
│   │   ├── Status (0/1/2)
│   │   ├── Chat History
│   │   ├── Booking History
│   │   └── Send Message (WhatsApp)
├── Offers
├── Analytics
└── Settings
```

### Customer List View
```
┌─────────────────────────────────────────┐
│  👥 Customers                    Search │
├─────────────────────────────────────────┤
│ 🟢 Active (1)                          │
│   Muhammad Ali  📞 03XX-XXXXXXX       │
│   Last Visit: 2 days ago              │
│   Bookings: 3  |  Status: 🟢 Active   │
├─────────────────────────────────────────┤
│ 🟡 New (0)                             │
│   Ahmed Khan   📞 03XX-XXXXXXX       │
│   Last Visit: Today                   │
│   Bookings: 0  |  Status: 🟡 New      │
├─────────────────────────────────────────┤
│ 🔴 Inactive (2)                        │
│   Sara Ali     📞 03XX-XXXXXXX       │
│   Last Visit: 45 days ago             │
│   Bookings: 1  |  Status: 🔴 Inactive │
└─────────────────────────────────────────┘
```

### Chat View (for Salon Owner)
```
┌─────────────────────────────────────────┐
│  ← Back        Chat with Muhammad Ali  │
├─────────────────────────────────────────┤
│ 📅 2 June 2026                         │
│ ┌────────────────────────────────┐     │
│ │ Customer: Hello, I want to     │     │
│ │ book a haircut                 │     │
│ └────────────────────────────────┘     │
│ ┌──────────────────────────────────┐   │
│ │   Bot: Select Service:          │   │
│ │   1. Haircut - Rs. 1000         │   │
│ │   2. Beard - Rs. 500            │   │
│ └──────────────────────────────────┘   │
│ ┌────────────────────────────────┐     │
│ │ Customer: 1                    │     │
│ └────────────────────────────────┘     │
├─────────────────────────────────────────┤
│ 📱 Send WhatsApp Message:              │
│ ┌──────────────────────────┐ [Send]   │
│ │ Type a message...        │          │
│ └──────────────────────────┘          │
└─────────────────────────────────────────┘
```

### Status Badge Component
```tsx
function StatusBadge({ status }: { status: number }) {
  const config = {
    0: { label: 'New', color: 'bg-yellow-500/20 text-yellow-400', icon: '🟡' },
    1: { label: 'Active', color: 'bg-emerald-500/20 text-emerald-400', icon: '🟢' },
    2: { label: 'Inactive', color: 'bg-red-500/20 text-red-400', icon: '🔴' },
  };
  const c = config[status as keyof typeof config] || config[0];
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>{c.icon} {c.label}</span>;
}
```

---

## 6. Backend Implementation

### Database Queries

```typescript
// Get salon customers with status
export async function getSalonCustomers(salonId: number): Promise<Customer[]> {
  const rows = await query(`
    SELECT DISTINCT c.*, 
      CASE 
        WHEN c.last_active >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1
        WHEN c.last_active IS NULL THEN 0
        ELSE 2
      END as status
    FROM customers c
    JOIN appointments a ON a.customer_phone = c.phone
    WHERE a.salon_id = ?
    ORDER BY c.last_active DESC
  `, [salonId]);
  return rows as Customer[];
}

// Get customer chat messages
export async function getCustomerChats(phone: string): Promise<Message[]> {
  const rows = await query(`
    SELECT * FROM chat_messages 
    WHERE phone = ? 
    ORDER BY timestamp ASC 
    LIMIT 50
  `, [phone]);
  return rows as Message[];
}

// Update customer last_active
export async function updateCustomerActivity(phone: string) {
  await query('UPDATE customers SET last_active = CURDATE() WHERE phone = ?', [phone]);
}
```

### Salon Auth Middleware
```typescript
function salonAuth(req: any, res: any, next: any) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET) as any;
    if (decoded.role !== 'salon' && decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Salon or Admin access required' });
    }
    req.salonId = decoded.salonId;
    req.isAdmin = decoded.role === 'admin';
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

### Salon Chat Routes
```typescript
// In salon-routes.ts
app.get('/api/salon/customers', salonAuth, async (req, res) => {
  const customers = await getSalonCustomers(req.salonId!);
  res.json(customers);
});

app.get('/api/salon/customers/:phone/chats', salonAuth, async (req, res) => {
  const { phone } = req.params;
  const chats = await getCustomerChats(phone);
  res.json(chats);
});

app.post('/api/salon/customers/:phone/message', salonAuth, async (req, res) => {
  const { phone } = req.params;
  const { message } = req.body;
  const sock = getWASocket();
  if (!sock) return res.status(500).json({ error: 'WhatsApp not connected' });
  await sock.sendMessage(phone, { text: message });
  res.json({ success: true });
});
```

---

## 7. WhatsApp Notifications for Bookings

Jab koi customer booking kare, to salon owner ko WhatsApp par notification mile:

```
🏪 *New Booking Alert* 🎉

Salon: Glow & Beauty
Customer: Muhammad Ali
Service: Haircut - Rs. 1000
Date: 05 June 2026
Time: 2:00 PM
Token: #A7K2X

📞 Customer: 03XX-XXXXXXX
```

### Implementation
```typescript
// In bot.ts - after CONFIRM_BOOKING state
async function notifySalonBooking(salonId: number, booking: any) {
  const salon = await getSalonById(salonId);
  if (!salon?.phone) return;
  const msg = `🏪 *New Booking Alert* 🎉\n\nSalon: ${salon.name}\nCustomer: ${booking.customer_name}\nService: ${booking.service_name}\nDate: ${booking.appointment_date}\nTime: ${booking.appointment_time}\nToken: ${booking.token}\n\n📞 Customer: ${booking.customer_phone}`;
  const sock = getWASocket();
  if (sock) await sock.sendMessage(salon.phone + '@s.whatsapp.net', { text: msg });
}
```

---

## 8. Super Admin Override

Super Admin ke pas sab kuch dekhne ka option hoga:

```typescript
// In admin-routes.ts - Super admin gets ALL customers
app.get('/api/admin/customers', adminAuth, async (req, res) => {
  const { salon_id, status } = req.query;
  let sql = 'SELECT DISTINCT c.* FROM customers c LEFT JOIN appointments a ON a.customer_phone = c.phone WHERE 1=1';
  const params: any[] = [];
  if (salon_id) { sql += ' AND a.salon_id = ?'; params.push(salon_id); }
  if (status !== undefined) { sql += ' AND c.status = ?'; params.push(status); }
  sql += ' ORDER BY c.last_active DESC';
  const rows = await query(sql, params);
  res.json(rows);
});
```

Admin panel mein ek dropdown hoga "View as Salon" jisse super admin kisi bhi salon ka data dekh sakta hai.

---

## 9. Implementation Steps

| Step | Task | File(s) | Priority |
|------|------|---------|----------|
| 1 | Add `status` and `last_active` columns to customers table | `schema.sql` | High |
| 2 | Create `getSalonCustomers`, `getCustomerChats` DB functions | `db.ts` | High |
| 3 | Create salon auth middleware | `salon-routes.ts` | High |
| 4 | Add salon customer/chat API routes | `salon-routes.ts` | High |
| 5 | Update super admin routes for full access | `admin-routes.ts` | Medium |
| 6 | Create Salon Customers frontend component | `src/salon/SalonCustomers.tsx` | High |
| 7 | Create Customer Chat view component | `src/salon/SalonChat.tsx` | High |
| 8 | Add StatusBadge component | `src/components/StatusBadge.tsx` | Medium |
| 9 | Add WhatsApp booking notification to salon owner | `bot.ts` | High |
| 10 | Update customer last_active on message/booking | `bot.ts`, `server.ts` | High |
| 11 | Test full flow | Manual | High |

---

## 10. Component Tree

```
SalonDashboard
├── Sidebar (with Customers tab)
├── SalonCustomers
│   ├── SearchBar
│   ├── StatusFilter (All/New/Active/Inactive)
│   └── CustomerList
│       └── CustomerCard
│           ├── StatusBadge
│           ├── CustomerInfo
│           └── Actions (Chat/Bookings/Message)
├── SalonChat
│   ├── ChatHeader (customer info)
│   ├── ChatMessages
│   │   └── MessageBubble
│   └── MessageInput
└── AdminOverride (for Super Admin)
    └── SalonSelector dropdown
```
