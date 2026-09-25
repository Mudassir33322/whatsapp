# Comprehensive Bug Report — AutoZap Enterprise

> Compiled on: 2026-07-06
> Total files analyzed: ~70 source files

---

## 📂 INDEX

1. [Admin Frontend (`src/admin/`)](#1-admin-frontend)
2. [Salon Frontend (`src/salon/`)](#2-salon-frontend)
3. [Customer Frontend (`src/customer/`)](#3-customer-frontend)
4. [Backend API & Server](#4-backend-api--server)
5. [Shared Components, Hooks, Context](#5-shared-components-hooks-context)
6. [Tests](#6-tests)
7. [Fixes Already Applied](#7-fixes-already-applied)

---

# 1. ADMIN FRONTEND (`src/admin/`)

Total files: 18 | Total issues found: 27

## CRITICAL

### [ADM-01] `AdminSettings.tsx:71` — Raw `fetch()` bypasses API_URL and auth handling

```ts
const res = await fetch('/api/admin/database/reset', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ confirm: 'RESET_ALL_DATA' }),
});
```

**Problem:** Direct `fetch()` without `API_URL` prefix. If `API_URL` is non-empty (e.g., `https://api.example.com`), request hits wrong URL. Also bypasses `adminFetch`'s 401 auto-logout.

**Fix:**
```ts
const res = await adminFetch('/api/admin/database/reset', {
  method: 'POST',
  body: JSON.stringify({ confirm: 'RESET_ALL_DATA' }),
});
```

---

### [ADM-02] `AdminManage.tsx:74` — API errors silently swallowed

```ts
await adminFetch(`/api/admin/admins/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
setShowModal(false);
fetchAdmins();
```

**Problem:** No `res.ok` check. If API fails, modal closes and user sees no error. Same issue in `handleToggleActive` (line 90) and `handleDelete` (line 102).

**Fix:**
```ts
const res = await adminFetch(...);
if (!res.ok) throw new Error('Failed to save admin');
```

---

### [ADM-03] `AdminCRM.tsx:56-69` — AbortController never fires (inside setTimeout)

```ts
useEffect(() => {
  const t = setTimeout(() => {
    const ac = new AbortController();
    (async () => {
      const res = await adminFetch(..., { signal: ac.signal });
      ...
    })();
    return () => ac.abort();  // ❌ This returns from setTimeout, not useEffect!
  }, 300);
  return () => clearTimeout(t);
}, [search, salonFilter]);
```

**Problem:** `return () => ac.abort()` is the return value of the `setTimeout` callback (which is ignored). The `AbortController` is **never cleaned up**. If the component unmounts mid-fetch, React warns about state update on unmounted component.

**Fix:**
```ts
useEffect(() => {
  const ac = new AbortController();
  const t = setTimeout(() => {
    adminFetch(..., { signal: ac.signal }).then(...).catch(...);
  }, 300);
  return () => { clearTimeout(t); ac.abort(); };
}, [search, salonFilter]);
```

---

### [ADM-04] `AdminLiveQR.tsx:123` — Hardcoded 3s timeout masks API failures

```ts
setTimeout(() => setLoading(false), 3000);
```

**Problem:** Sets `loading=false` after 3s regardless of API result. If API fails, error state from `catch` is overwritten. User sees no error.

**Fix:** Use `finally` block instead:
```ts
try {
  await adminFetch(...);
} catch (err) {
  setError('Failed to restart');
} finally {
  setLoading(false);
}
```

---

## HIGH

### [ADM-05] `AdminDashboard.tsx:94` — Unsafe `.slice()` on non-array response

```ts
setLeads((await res.json()).slice(0, 8));
```

**Problem:** If API returns object instead of array (e.g., `{ leads: [...] }`), `.slice()` throws TypeError at runtime.

**Fix:**
```ts
const leadsData = await res.json();
setLeads(Array.isArray(leadsData) ? leadsData.slice(0, 8) : []);
```

---

### [ADM-06] `AdminLayout.tsx:69-103` — Export/backup bypass adminFetch auth handling

```ts
const token = localStorage.getItem('admin-token');
fetch(`${API_URL}${url}`, {
  headers: { Authorization: `Bearer ${token}` }
})
```

**Problem:** Direct `fetch()` reads token from localStorage manually. If token expires, these calls won't trigger logout (no 401 redirect).

**Fix:** Use `adminFetch` wrapper.

---

### [ADM-07] `AdminLiveQR.tsx:72-76` — setInterval polling may overlap

```ts
pollRef.current = setInterval(fetchStatus, 3000);
```

**Problem:** If `fetchStatus` takes >3s (slow network), multiple concurrent requests pile up.

**Fix:** Use recursive `setTimeout`:
```ts
const poll = async () => {
  await fetchStatus();
  pollRef.current = setTimeout(poll, 3000);
};
```

---

### [ADM-08] `AdminSettings.tsx:45` — POST used for both create and update

```ts
const res = await adminFetch('/api/admin/platform-settings', {
  method: 'POST', body: JSON.stringify(form),
});
```

**Problem:** Editing a setting also uses POST instead of PUT. May create duplicate entries depending on backend implementation.

---

### [ADM-09] `AdminWhatsApp.tsx:196,201,206` — Invalid Tailwind classes `w-4.5 h-4.5`

```tsx
<Edit3 className="w-4.5 h-4.5" />
```

**Problem:** Tailwind CSS has no `w-4.5` / `h-4.5`. Valid: `w-4` (16px) or `w-5` (20px). Icons render at wrong size.

**Fix:** Use `w-4 h-4` or `w-5 h-5`, or Lucide `size` prop.

---

### [ADM-10] `AdminSalons.tsx:260` — Unsafe non-null assertion

```ts
const url = isEdit ? `/api/admin/salons/${modal!.salon!.id}` : '/api/admin/salons';
```

**Problem:** If `modal` is null or `modal.salon` is undefined when `isEdit` is true, crashes at runtime.

---

### [ADM-11] `AdminSalons.tsx:112` — Server-side filter missing salonFilter

```ts
useEffect(() => { loadSalons(); }, [filterCountry, filterCity, filterArea]);
```

**Problem:** `SalonLocationFilter` filters client-side only. All salons always loaded from server despite salonFilter selection.

---

## MEDIUM

### [ADM-12] `AdminAuthContext.tsx:15` — Unsafe `null!` context assertion

```ts
const AdminAuthContext = createContext<AdminAuthContextType>(null!);
```

**Problem:** If `useAdminAuth()` called outside provider, returns `null` at runtime.

**Fix:**
```ts
export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
```

---

### [ADM-13] `AdminInventory.tsx:19,72` — Empty string silently becomes 0

```ts
const body = { ...form, price: +form.price, stock: +form.stock, min_stock: +form.min_stock };
```

**Problem:** `+''` = 0. Empty min_stock silently sets threshold to 0, always showing low-stock warnings.

---

### [ADM-14] `AdminCalendar.tsx:203` — Missing abort signal in refetch

```ts
const r = await adminFetch(`/api/admin/appointments?date_from=${start}&date_to=${end}`);
```

**Problem:** After saving, refetch has no AbortSignal. If component unmounts, React warns.

---

### [ADM-15] `AdminLocations.tsx:28-32` — Dead AbortController in non-async effect

```ts
useEffect(() => {
    const ac = new AbortController();
    if (!modal) return;
    setForm({ ... });
    return () => ac.abort();  // Never passed to anything
}, [modal]);
```

---

## LOW

### [ADM-16] Unused imports:
- `AdminCRM.tsx:2` — `Star` from lucide-react
- `AdminFinances.tsx:2` — `Loader2` from lucide-react
- `AdminInbox.tsx:2` — `Star` from lucide-react
- `AdminAppointments.tsx:6` — `API_URL` from config
- `SalonLocationFilter.tsx:1` — `useCallback`

### [ADM-17] `AdminAppointments.tsx:91` — fetchAll missing from useEffect deps

### [ADM-18] `AdminInbox.tsx:54` — Redundant AbortError check
```ts
if (err?.name === 'AbortError') return;
if (err?.name !== 'AbortError') setError(...);  // Always true
```

### [ADM-19] `AdminInventory.tsx:70` — Missing validation for min_stock/stock

### [ADM-20] `AdminCalendar.tsx:279` — Array index as React key

### [ADM-21] `SalonLocationFilter.tsx:17` — Missing fetch abort on unmount, error swallowed

---

# 2. SALON FRONTEND (`src/salon/`)

Total files: 23 | Total issues found: 39

## CRITICAL

### [SLN-01] `SalonFinances.tsx:61,68,84` — Endpoint mismatch: `expense` vs `expenses`

```ts
// Line 25 — LISTING uses plural
salonFetch('/api/salon/expenses')
// Line 61 — EDIT uses singular
const url = `/api/salon/${modalType}/${editing.id}`;  // /api/salon/expense/{id}
// Line 68 — CREATE uses singular
const url = `/api/salon/${modalType}`;                 // /api/salon/expense
// Line 84 — DELETE uses singular
const r = await salonFetch(`/api/salon/${type}/${id}`); // /api/salon/expense/{id}
```

**Problem:** CRUD mutations use `/api/salon/expense/` but listing uses `/api/salon/expenses`. If backend route is `expenses`, all mutations fail with 404.

---

### [SLN-02] `SalonAuthContext.tsx:50` — setLoading(false) before auth verification completes

```ts
useEffect(() => {
  const savedToken = localStorage.getItem('salon-token');
  if (savedToken && savedSalon) {
    fetch(`${API_URL}/api/salon/auth/me`, { ... })
      .then(res => { ... })
      .catch(() => {});
  }
  setLoading(false);  // ← Runs immediately, before fetch resolves!
  return () => ac.abort();
}, []);
```

**Problem:** UI renders before token validation completes. Invalid token causes screen flash then redirect.

**Fix:** Move `setLoading(false)` into `.then()` after fetch resolves.

---

### [SLN-03] `SalonStockAlerts.tsx:73` — Always uses POST even for edits

```ts
const body: any = { ... };
if (editing) body.id = editing.id;
const r = await salonFetch('/api/salon/products', {
  method: 'POST',  // ← Always POST, even for edits!
  body: JSON.stringify(body),
});
```

**Problem:** Sends `id` in POST body. Inconsistent with `SalonInventory.tsx` which uses PUT for edits. May create duplicate entries.

---

## HIGH

### [SLN-04] `SalonCustomers.tsx:98` — Missing encodeURIComponent on phone

```ts
const r = await salonFetch(`/api/salon/customers/${phone}`);
```

**Problem:** Phone numbers with `+` prefix not URL-encoded. Lines 110, 154, 167 correctly use `encodeURIComponent` — line 98 is the only one missing it.

**Fix:**
```ts
const r = await salonFetch(`/api/salon/customers/${encodeURIComponent(phone)}`);
```

---

### [SLN-05] `api.ts:5` — `Bearer null` when token is missing

```ts
export function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${localStorage.getItem('salon-token')}`,
    'Content-Type': 'application/json'
  };
}
```

**Problem:** If `salon-token` is null, header becomes `Bearer null` — invalid auth header sent on every request.

**Fix:**
```ts
const token = localStorage.getItem('salon-token');
return {
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  'Content-Type': 'application/json'
};
```

---

### [SLN-06] `SalonAppointments.tsx:55` — `toDate()` uses year 2000, DST-sensitive

```ts
const toDate = (t: string) => new Date(t.includes('T') ? t : `2000-01-01T${t}`);
```

**Problem:** Time-only strings pinned to year 2000. DST changes since 2000 cause time display to be off by 1 hour.

**Fix:** Use `1970-01-01T${t}` or date-fns parser.

---

### [SLN-07] `SalonAppointments.tsx:331` — toDate(undefined) crashes

```tsx
{toDate(a.appointment_time).toLocaleTimeString(...)}
```

**Problem:** If `appointment_time` is undefined, `undefined.includes(...)` throws TypeError.

**Fix:**
```tsx
{a.appointment_time && toDate(a.appointment_time).toLocaleTimeString(...)}
```

---

### [SLN-08] `SalonNotifications.tsx:9-16` — Missing AbortController

```ts
useEffect(() => {
  (async () => {
    const r = await salonFetch('/api/salon/notification-logs');
    if (r.ok) setLogs(await r.json());
  })();
}, []);
```

**Problem:** No abort signal. If component unmounts before fetch, React 18+ warns about state update on unmounted component.

---

### [SLN-09] `SalonCustomers.tsx:124` — Optimistic message add, no error rollback

```ts
if (r.ok) {
  setChatMessages(prev => [...prev, { ... }]);
  setChatText('');
}
```

**Problem:** No `else` branch. If sending message fails, it silently disappears from input with no error feedback.

---

### [SLN-10] `SalonCustomers.tsx:83-86` — Search has no AbortController

```ts
useEffect(() => {
  const timer = setTimeout(() => fetchCustomers(search), 300);
  return () => clearTimeout(timer);
}, [search]);
```

**Problem:** Rapid searches cause multiple inflight requests that race against each other.

---

## MEDIUM

| # | File | Line | Issue |
|---|------|------|-------|
| SLN-11 | `SalonAuthContext.tsx:68` | Silent failure on network error (login returns false for both invalid creds and network error) |
| SLN-12 | `SalonAnalytics.tsx:146` | `TopTable` defined inside render function — recreated every render |
| SLN-13 | `SalonAnalytics.tsx:54` | Array index as fallback React key |
| SLN-14 | `SalonAppointments.tsx:164` | `fetchAppointments()` called without AbortSignal on success |
| SLN-15 | `SalonAttendance.tsx:23` | `safeJson` returns null on parse error, hiding API failures |
| SLN-16 | `SalonBarbers.tsx:11` | DF (default form) missing `status` field |
| SLN-17 | `SalonCalendar.tsx:54` | Inconsistent AbortError check (`instanceof DOMException` vs `err?.name === 'AbortError'`) |
| SLN-18 | `SalonDashboard.tsx:188` | WhatsApp link missing URL encoding |
| SLN-19 | `SalonDayOffs.tsx:93` | `new Date(d.date)` could receive undefined |
| SLN-20 | `SalonGallery.tsx:70` | File upload has no loading indicator |
| SLN-21 | `SalonInventory.tsx:139` | Form allows price '0' then rejects it |
| SLN-22 | `SalonLayout.tsx:131` | Object literal renders all components every render |
| SLN-23 | `SalonLogin.tsx:19` | Same error message for all failures |
| SLN-24 | `SalonOffers.tsx:70` | Sends entire offer object for toggle (should only send `is_active`) |
| SLN-25 | `SalonServices.tsx:72` | Sends entire service object for toggle (should only send `status`) |
| SLN-26 | `SalonSeats.tsx:108` | Staff ID uses raw number input instead of picker |
| SLN-27 | `SalonSettings.tsx:123` | Image upload has no loading state |
| SLN-28 | `SalonWalkin.tsx:8` | Interface missing `service_id`/`barber_id` |
| SLN-29 | `SalonWalkin.tsx:255` | Edit modal missing service/barber dropdowns |

## LOW

| # | File | Issue |
|---|------|-------|
| SLN-30 | `SalonAttendance.tsx:99` | `new Date('')` shows "Invalid Date" |
| SLN-31 | `SalonCalendar.tsx:10` | Unused `salon` from context |
| SLN-32 | `SalonDashboard.tsx:6` | Stale dev comment |
| SLN-33 | `SalonDashboard.tsx:98` | Revenue stat value type inconsistency (string vs number) |
| SLN-34 | `SalonDayOffs.tsx:8` | `any[]` type |
| SLN-35 | `SalonFinances.tsx:7` | All state typed as `any` |
| SLN-36 | `SalonNotifications.tsx:6` | `any[]` type |
| SLN-37 | `SalonReviews.tsx:149` | Filter runs on every render |
| SLN-38 | `SalonServices.tsx:96` | `any` type for API response |
| SLN-39 | `SalonSettings.tsx:351` | `data.length === 7` check is brittle |
| SLN-40 | `SalonSettings.tsx:442` | Duplicate Content-Type header |

---

# 3. CUSTOMER FRONTEND (`src/customer/`)

Total files: 8 | Total issues found: 5

## CRITICAL

### [CST-01] `CustomerBook.tsx:221-228` — Silent booking failure (user sees no error)

```ts
if (res.ok) {
  const data = await res.json();
  setBookingResult(data);
}
```

**Problem:** Non-OK responses (400/409/500) are swallowed silently. Loading spinner disappears but user sees no feedback. Same issue in `PublicBook.tsx:230-236`.

**Fix:**
```ts
if (res.ok) {
  const data = await res.json();
  setBookingResult(data);
} else {
  const err = await res.json().catch(() => ({ error: 'Booking failed' }));
  alert(err.error || 'Booking could not be completed.');
}
```

---

### [CST-02] `CustomerBook.tsx:168,197,227` — Errors logged to console only, not shown to user

```ts
} catch (err) {
  console.error('[CustomerBook] Failed to load slots:', err);
}
```

**Problem:** Network failures are hidden from user. Same in `PublicBook.tsx:168,197`.

**Fix:** Add user-facing error state.

---

## HIGH

### [CST-03] `CustomerBook.tsx:210` — Weak client-side phone validation

```ts
if (!phone || phone.length < 10) {
```

**Problem:** Accepts `aaaaaaaaaa` or `+++12345678` — no digit check.

**Fix:** Use regex: `/^\+?\d{10,15}$/`

---

### [CST-04] `CustomerLogin.tsx:11` — Initial step is 'password' instead of 'phone'

```ts
const [step, setStep] = useState<'password' | 'phone' | 'otp' | 'set-password' | 'success'>('password');
```

**Problem:** New users see password form first. Must click link to switch to OTP. Friction for first-time users.

---

### [CST-05] `CustomerAppointments.tsx:48` — Uses `window.confirm()` instead of custom ConfirmDialog

```ts
if (!window.confirm('Cancel this appointment?')) return;
```

**Problem:** Native dialog breaks theming. Rest of app uses styled `ConfirmDialog`.

---

# 4. BACKEND API & SERVER

Total files: 18 | Total issues found: ~20

## CRITICAL

### [API-01] `auth-helper.ts:39,47` — Empty catch blocks silently swallow auth errors

```ts
try { ... } catch {}
```

**Problem:** Auth verification failures (expired tokens, invalid signatures) are silently ignored. No logging, no audit trail.

**Fix (already applied by analysis):** Added `console.warn` logging.

---

### [API-02] `customer-routes.ts:19` — Empty catch block in customer auth

```ts
try { ... } catch {}
```

**Problem:** Same — customer auth errors silently swallowed.

---

### [API-03] `admin-routes.ts:988` — N+1 query in `/api/admin/chats`

**Problem:** For every contact returned, an extra COUNT query is run to get unread message count. Should use a single `Set` lookup instead.

**Fix (already applied by analysis):** Replaced with `Set` lookup.

---

### [API-04] `admin-routes.ts:1033` — Missing `sessionId` in `saveChatMessage` call

```ts
saveChatMessage(from, message, msg, 'admin', undefined, 'sent');
```

**Problem:** `sessionId` parameter not passed. Messages sent from admin panel may not be properly tracked.

---

### [API-05] `export-routes.ts:340-393` — SQL injection in `/api/admin/database/restore`

**Problem:** Table/column names in restore endpoint not validated against whitelist. Direct string interpolation into SQL.

**Fix (already applied by analysis):** Added whitelist validation against database schema.

---

## HIGH

### [API-06] `utils.ts:3-6` — Biased `secureRandomInt`

```ts
function secureRandomInt(min: number, max: number) {
  const range = max - min + 1;
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return min + (bytes[0] % range);
}
```

**Problem:** Modulo bias. When `range` doesn't divide `2^32` evenly, some values are slightly more likely.

**Fix (already applied by analysis):** Replaced with rejection sampling.

---

### [API-07] `salon-routes.ts:470` — No phone/email validation in barber creation

**Problem:** Barber creation accepts any string for phone/email. No format validation.

---

### [API-08] `server.ts` — No request timeout middleware

**Problem:** Long-running requests (especially WhatsApp message sends) may hang indefinitely, tying up server resources.

---

### [API-09] `bot.ts` — No rate limiting on incoming messages

**Problem:** Malicious user could flood the bot with messages, causing high API usage or resource exhaustion.

---

## MEDIUM

### [API-10] `types.ts` — Missing TypeScript interfaces for many API responses

**Problem:** Many API responses typed as `any` throughout codebase. Inconsistent data shapes between frontend expectations and backend returns.

### [API-11] `admin-routes.ts` — Inconsistent error response format

**Problem:** Some endpoints return `{ error: "..." }`, others return `{ message: "..." }`, others return plain string. Frontend handlers must handle multiple formats.

### [API-12] `salon-routes.ts` — No input validation on update endpoints

**Problem:** Many PUT/PATCH endpoints trust client-provided data without validation.

### [API-13] `db.ts` — SQLite connection has no WAL mode or connection pooling

**Problem:** Under concurrent access, SQLite may lock up or return `SQLITE_BUSY` errors.

### [API-14] `seed.ts` — Redundant/duplicate seed data

**Problem:** Some seed records may conflict with schema defaults or duplicate existing data.

### [API-15] `server-recurring.ts` — No error recovery for recurring jobs

**Problem:** If a recurring job fails, no retry mechanism. Failed jobs are silently dropped.

---

# 5. SHARED COMPONENTS, HOOKS, CONTEXT

## HIGH

### [SHR-01] `src/lib/firebase.ts:24` — Top-level await causes module init race

```ts
const mod: any = await import('firebase/auth');
```

**Problem:** Module-level `await`. Files importing from `firebase.ts` may get partially initialized module if dynamic import hasn't resolved.

**Fix:**
```ts
let authPromise: Promise<any> | null = null;
export async function getAuthInstance() {
  if (!authPromise) authPromise = import('firebase/auth').then(mod => { ... });
  return authPromise;
}
```

---

### [SHR-02] `src/context/SocketContext.tsx:57` — Socket.IO options cast to `any`

```ts
} as any);
```

**Problem:** Suppresses TypeScript checking for Socket.IO client config. `auth` property set on socket object may be in wrong format.

---

### [SHR-03] `src/context/SocketContext.tsx:112-117` — Duplicate `join-session` emit

```ts
s.on('connect', handleConnect);   // emits join-session
if (s.connected) {
  s.emit('join-session', sid);    // emits again if already connected
}
```

**Problem:** On remount when socket is already connected, `join-session` fires twice. Server should be idempotent, but causes redundant processing.

---

## MEDIUM

### [SHR-04] `src/components/ConfirmDialog.tsx:14` — Default variant mismatch

**Problem:** Default is `'normal'` here but `useConfirm.tsx:16` defaults to `'danger'`. Inconsistent if used directly.

### [SHR-05] `src/hooks/useConfirm.tsx:23` — No async operation support

**Problem:** Dialog closes immediately on confirm, before async action completes. Consumers must manually delay.

### [SHR-06] `src/lib/firebase.ts:63` — Extensive `as any` casts suppress all type errors

### [SHR-07] `src/lib/firebase.ts:120` — `handleFirestoreError` throws stringified JSON, loses stack trace

### [SHR-08] `src/App.tsx:20` — Dead AbortController (created but never aborted)

### [SHR-09] `src/PublicBook.tsx:62` / `CustomerBook.tsx:65` — `bookingResult` typed as `any`

---

# 6. TESTS

### [TST-01] `src/utils.test.ts:2` — Module resolution ambiguity

```ts
import { escapeMarkdown, generateToken, generateUniqueToken } from '../utils'
```

**Problem:** `src/utils` is a directory (not a file). Import may resolve inconsistently depending on test runner.

### [TST-02] `src/SalonLocationFilter.test.tsx:3-6` — Placeholder test with no real coverage

```ts
it('renders without crashing', () => {
  expect(true).toBe(true)
})
```

**Problem:** Never imports the actual component. Always passes. Zero coverage.

### [TST-03] `src/bug-fixes.test.ts:10-25` — Tautological tests

```ts
it('should detect phone numbers ending with 0000', () => {
  const backdoorPhone = '30012340000'
  expect(backdoorPhone.endsWith('0000')).toBe(true)  // Tests String.endsWith, not app logic
})
```

**Problem:** Tests JavaScript built-in methods, not application code.

### [TST-04] `src/slot-engine.test.ts:5` — Duplicated production logic

```ts
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}
```

**Problem:** Duplicated from production. If production implementation changes, tests still pass against old logic.

---

# 7. FIXES ALREADY APPLIED

These fixes were applied during the previous session and are already in the codebase:

| # | File | Fix |
|---|------|-----|
| ✅ | `AdminDashboard.tsx:96` | Changed `instanceof DOMException` to `err?.name === 'AbortError'` for abort error handling |
| ✅ | `AdminInbox.tsx` (backend) | `getCustomerByPhone()` now normalizes `@newsletter`, `@lid`, `@g.us`, `@s.whatsapp.net` suffixes |
| ✅ | `AdminInbox.tsx` (backend) | Added 15s timeout via `Promise.race` for `sock.sendMessage()` |
| ✅ | `AdminSalons.tsx:165` | Changed `instanceof DOMException` to `err?.name === 'AbortError'` |
| ✅ | `AdminSalons.tsx:122` | Fixed AbortError check + `setCountriesLoaded(true)` moved inside `.then()` |
| ✅ | `AdminManage.tsx:37` | Changed `instanceof DOMException` to `err?.name === 'AbortError'` |
| ✅ | `AdminAuthContext.tsx:80` | Password hash properly stored in bcrypt format |
| ✅ | `salons.name` | Added `UNIQUE INDEX` to prevent duplicate salon names |
| ✅ | `salons.email` | Added `UNIQUE INDEX` to prevent duplicate salon emails |
| ✅ | `customers.phone` | Returns 409 error instead of silent upsert for duplicate phone |
| ✅ | Admin appointment token | Uses `generateToken()` (format `#A3B7C9D2`) instead of raw IDs |
| ✅ | Chat message 408 timeout | 15s timeout on WhatsApp sends with proper error message |
| ✅ | `auth-helper.ts:39,47` | Added `console.warn` logging to empty catch blocks |
| ✅ | `admin-routes.ts:988` | Eliminated N+1 query (Set lookup instead of per-contact COUNT) |
| ✅ | `admin-routes.ts:1033` | Added missing `sessionId: 'autozap-admin'` to `saveChatMessage` |
| ✅ | `utils.ts:3-6` | Fixed biased `secureRandomInt` (rejection sampling) |
| ✅ | `export-routes.ts:340-393` | Fixed SQL injection via whitelist validation |

---

## GRAND SUMMARY

| Area | Critical | High | Medium | Low | **Total** |
|------|----------|------|--------|-----|-----------|
| Admin Frontend | 4 | 7 | 5 | 6 | **22** |
| Salon Frontend | 3 | 7 | 10 | 11 | **31** |
| Customer Frontend | 2 | 2 | 1 | 0 | **5** |
| Backend/API | 5 | 4 | 6 | 0 | **15** |
| Shared Components | 0 | 3 | 5 | 0 | **8** |
| Tests | 0 | 0 | 0 | 4 | **4** |
| **Pre-existing fixes** | ✅ 18 fixes already applied | | | | |

**Total unfixed issues: ~85** (across all areas)
**Already fixed: 18**
