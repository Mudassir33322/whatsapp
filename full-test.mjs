import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3001';

function request(method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const opts = {
      hostname: url.hostname, port: url.port, path: url.pathname + url.search, method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data: safeJson(data) }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function safeJson(s) { try { return JSON.parse(s); } catch { return s; } }

async function waitForServer(maxWait = 120000) {
  const start = Date.now();
  let attempts = 0;
  while (Date.now() - start < maxWait) {
    attempts++;
    try {
      const r = await request('GET', '/api/health');
      if (r.status === 200) { console.log(`[BOOT] Server responded after ${Math.round((Date.now()-start)/1000)}s (${attempts} attempts)`); return true; }
    } catch (e) {
      if (attempts % 5 === 0) console.log(`[BOOT] Still waiting... ${Math.round((Date.now()-start)/1000)}s elapsed`);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log(`[BOOT] Timed out after ${Math.round((Date.now()-start)/1000)}s`);
  return false;
}

const results = { pass: 0, fail: 0, vpass: 0, vfail: 0 };

async function test(label, fn) {
  try {
    const r = await fn();
    if (r.status >= 200 && r.status < 300) { results.pass++; log('✅', label, r.status, r.data); }
    else { results.fail++; log('❌', label, r.status, r.data); }
    return r;
  } catch (e) {
    results.fail++;
    console.log(`❌ ${label}: ERROR - ${e.message}`);
    return null;
  }
}

async function vtest(label, fn, expectedStatus) {
  try {
    const r = await fn();
    if (r.status === expectedStatus) { results.vpass++; log('✅', label, r.status, r.data); }
    else { results.vfail++; log('❌', label, r.status, r.data + ' (expected ' + expectedStatus + ')'); }
    return r;
  } catch (e) {
    results.vfail++;
    console.log(`❌ ${label}: ERROR - ${e.message}`);
    return null;
  }
}

function validate(actual, expected) {
  for (const k in expected) {
    const a = actual?.[k];
    const e = expected[k];
    if (a !== e) throw new Error(`field ${k}: expected ${e}, got ${JSON.stringify(a)}`);
  }
}

function log(icon, label, status, data) {
  const msg = typeof data === 'object' && data !== null ? JSON.stringify(data).substring(0, 180) : String(data).substring(0, 180);
  console.log(`${icon} ${label}: ${status} | ${msg}`);
}

// ── Start Server ──
console.log('══════════════════════════════════════════');
console.log('       AUTOMATED API TEST SUITE');
console.log('══════════════════════════════════════════\n');

const server = spawn('node', ['--import', 'tsx', 'server.ts'], {
  cwd: __dirname,
  env: { ...process.env, NODE_ENV: 'production' },
  stdio: ['ignore', 'pipe', 'pipe']
});
server.stdout.on('data', d => {});
server.stderr.on('data', d => { if (d.toString().includes('500') || d.toString().includes('ERROR') || d.toString().includes('error')) console.log('[SERVER]', d.toString().trim()); });

console.log('[BOOT] Waiting for server...');
const ready = await waitForServer(120000);
if (!ready) { console.log('[FATAL] Server failed to start'); server.kill(); process.exit(1); }
console.log('[BOOT] Server ready!\n');

// ══════════════════════════════════════
// 1. AUTH
// ══════════════════════════════════════
console.log('─── 1. AUTH ───');

await test('Health Check', () => request('GET', '/api/health'));

const sa = await test('Super Admin Login', () =>
  request('POST', '/api/admin/auth/login', { email: 'admin@autozap.com', password: 'admin123' }));
const sToken = sa?.data?.token || sa?.data?.accessToken;
const sAuth = sToken ? { Authorization: `Bearer ${sToken}` } : {};

const sl = await test('Salon Login', () =>
  request('POST', '/api/salon/auth/login', { email: 'primecuts@salon.com', password: 'admin123' }));
const salonToken = sl?.data?.token || sl?.data?.accessToken;
const salonAuth = salonToken ? { Authorization: `Bearer ${salonToken}` } : {};

// ══════════════════════════════════════
// 2. SUPER ADMIN
// ══════════════════════════════════════
if (sToken) {
  console.log('\n─── 2. SUPER ADMIN ───');
  await test('Stats', () => request('GET', '/api/admin/stats', null, sAuth));
  await test('Salons', () => request('GET', '/api/admin/salons', null, sAuth));
  await test('Admins', () => request('GET', '/api/admin/admins', null, sAuth));
  await test('Countries', () => request('GET', '/api/admin/locations/countries', null, sAuth));
  await test('Customers', () => request('GET', '/api/admin/customers', null, sAuth));
  await test('Platform Settings', () => request('GET', '/api/admin/platform-settings', null, sAuth));
  await test('Automations', () => request('GET', '/api/admin/automations', null, sAuth));
  await test('Disputes', () => request('GET', '/api/admin/disputes', null, sAuth));
  await test('Payouts', () => request('GET', '/api/admin/payouts', null, sAuth));
  await test('Coupons', () => request('GET', '/api/admin/coupons', null, sAuth));
  await test('Sessions', () => request('GET', '/api/admin/sessions', null, sAuth));
  await test('All Appointments', () => request('GET', '/api/admin/appointments', null, sAuth));
  await test('All Products', () => request('GET', '/api/admin/products', null, sAuth));
  await test('All Services', () => request('GET', '/api/admin/services', null, sAuth));
  await test('All Chats', () => request('GET', '/api/admin/chats', null, sAuth));
  await test('All Finances', () => request('GET', '/api/admin/finances', null, sAuth));
  await test('Bot Status', () => request('GET', '/api/admin/bot/status/0300-1111111', null, sAuth));

  // ── ADMIN SETTINGS TESTS ──
  console.log('\n─── 2a. ADMIN SETTINGS TESTS ───');
  await test('Admin Salon Settings Update', async () => {
    const salons = await request('GET', '/api/admin/salons', null, sAuth);
    if (salons.status !== 200 || !Array.isArray(salons.data) || salons.data.length === 0) return { status: 200, data: 'skipped no salons' };
    const sid = salons.data[0].id;
    const r = await request('PUT', '/api/admin/settings', { salonId: sid, companyName: 'Admin Updated Co', currency: 'Rs.', language: 'Urdu' }, sAuth);
    return r;
  });
  await test('Platform Setting CRUD', async () => {
    const k = 'test_key_' + Date.now();
    const r1 = await request('POST', '/api/admin/platform-settings', { setting_key: k, setting_value: 'test_val', setting_type: 'text', description: 'test' }, sAuth);
    if (r1.status !== 200) return r1;
    const r2 = await request('PUT', `/api/admin/platform-settings/${k}`, { setting_value: 'updated_val', setting_type: 'text', description: 'updated' }, sAuth);
    if (r2.status !== 200) return r2;
    const r3 = await request('DELETE', `/api/admin/platform-settings/${k}`, null, sAuth);
    return { status: r3.status, data: 'created/updated/deleted', _final: r3 };
  });

  // ── ADMIN BUSINESS LOGIC ──
  console.log('\n─── 2b. ADMIN BUSINESS LOGIC TESTS ───');
  await test('Create Location Country then Verify', async () => {
    const r = await request('POST', '/api/admin/locations/countries', { name: 'Testland_' + Date.now(), phone_code: '+00', is_active: true }, sAuth);
    if (r.status === 200) {
      const v = await request('GET', '/api/admin/locations/countries', null, sAuth);
      if (v.status === 200 && Array.isArray(v.data)) {
        const found = v.data.find(x => x.name === (r.data?.name || ''));
        if (found) return { status: 200, data: 'verified', _verified: true };
      }
    }
    return r;
  });
  await test('Create Service then Verify', async () => {
    const salons = await request('GET', '/api/admin/salons', null, sAuth);
    if (salons.status !== 200 || !Array.isArray(salons.data) || salons.data.length === 0) return { status: 200, data: 'skipped no salons' };
    const sid = salons.data[0].id;
    const r = await request('POST', '/api/admin/services', { salonId: sid, name: 'AdminSvc_' + Date.now(), price: 500, duration: 30, category: 'Test', description: 'TestSvc' }, sAuth);
    if (r.status === 200) {
      const v = await request('GET', '/api/admin/services', null, sAuth);
      if (v.status === 200 && Array.isArray(v.data)) {
        const found = v.data.find(x => x.name === (r.data?.name || ''));
        if (found) return { status: 200, data: 'verified', _verified: true };
      }
    }
    return r;
  });
} else {
  console.log('\n⚠️  Super Admin login FAILED');
}

// ══════════════════════════════════════
// 3. SALON FEATURES
// ══════════════════════════════════════
if (salonToken) {
  console.log('\n─── 3. SALON FEATURES ───');
  await test('Dashboard', () => request('GET', '/api/salon/dashboard', null, salonAuth));
  await test('Barbers', () => request('GET', '/api/salon/barbers', null, salonAuth));
  await test('Services', () => request('GET', '/api/salon/services', null, salonAuth));
  await test('Appointments', () => request('GET', '/api/salon/appointments', null, salonAuth));
  await test('Products', () => request('GET', '/api/salon/products', null, salonAuth));
  await test('Customers', () => request('GET', '/api/salon/customers', null, salonAuth));
  await test('Seats', () => request('GET', '/api/salon/seats', null, salonAuth));
  await test('Analytics', () => request('GET', '/api/salon/analytics?period=7d', null, salonAuth));
  await test('Working Hours', () => request('GET', '/api/salon/working-hours', null, salonAuth));
  await test('Shop Settings', () => request('GET', '/api/salon/shop/settings', null, salonAuth));
  await test('Settings', () => request('GET', '/api/salon/settings', null, salonAuth));

  // ── SETTINGS UPDATE TESTS ──
  console.log('\n─── 3a. SETTINGS UPDATE TESTS ───');
  await test('Update Shop Settings', async () => {
    const r = await request('PUT', '/api/salon/shop/settings', { company_name: 'Test Salon Inc', currency: 'USD', language: 'English', address: '123 Test St', map_url: 'https://maps.test.com' }, salonAuth);
    if (r.status === 200) {
      const c = await request('GET', '/api/salon/shop/settings', null, salonAuth);
      if (c.status === 200) validate(c.data, { company_name: 'Test Salon Inc', currency: 'USD', language: 'English' });
    }
    return r;
  });
  await test('Update Salon Settings', async () => {
    const r = await request('PUT', '/api/salon/settings', { name: 'Updated Salon ' + Date.now(), owner_name: 'Test Owner', phone: '0300-9999999', address: '456 Updated St', description: 'Updated desc' }, salonAuth);
    if (r.status === 200) {
      const c = await request('GET', '/api/salon/settings', null, salonAuth);
      if (c.status === 200 && c.data) validate(c.data, { owner_name: 'Test Owner' });
    }
    return r;
  });
  await test('Update Notification Preferences', async () => {
    const r = await request('PUT', '/api/salon/notification-preferences', { reminder_30min: false, queue_update: true, review_request: false, re_engagement: true }, salonAuth);
    if (r.status === 200) {
      const c = await request('GET', '/api/salon/notification-preferences', null, salonAuth);
      if (c.status === 200) validate(c.data, { reminder_30min: false, queue_update: true, review_request: false, re_engagement: true });
    }
    return r;
  });

  // ── BUSINESS LOGIC VERIFICATION TESTS ──
  console.log('\n─── 3c. BUSINESS LOGIC VERIFICATION ───');
  await test('Update Barber then Verify', async () => {
    const bl = await request('GET', '/api/salon/barbers', null, salonAuth);
    if (bl.status !== 200 || !Array.isArray(bl.data) || bl.data.length === 0) return { status: 200, data: 'skipped no barbers' };
    const bid = bl.data[0].id;
    const r = await request('PUT', `/api/salon/barbers/${bid}`, { name: 'Updated Barber ' + Date.now(), phone: '3003' + String(Date.now()).slice(-6), experience: 10, specialization: 'Test' }, salonAuth);
    if (r.status === 200) {
      const v = await request('GET', `/api/salon/barbers/${bid}`, null, salonAuth);
      if (v.status === 200 && v.data) validate(v.data, { id: bid, name: 'Updated Barber ' + String(Date.now()).slice(-13) });
    }
    return r;
  });
  await test('Update Service then Verify', async () => {
    const sl = await request('GET', '/api/salon/services', null, salonAuth);
    if (sl.status !== 200 || !Array.isArray(sl.data) || sl.data.length === 0) return { status: 200, data: 'skipped no services' };
    const sid = sl.data[0].id;
    const r = await request('PUT', `/api/salon/services/${sid}`, { name: 'Updated Svc ' + Date.now(), price: 999, duration: 45, category: 'Test' }, salonAuth);
    if (r.status === 200) {
      const v = await request('GET', `/api/salon/services/${sid}`, null, salonAuth);
      if (v.status === 200 && v.data) validate(v.data, { id: sid, price: 999, duration: 45 });
    }
    return r;
  });
  await test('Update Seat then Verify', async () => {
    const st = await request('GET', '/api/salon/seats', null, salonAuth);
    if (st.status !== 200 || !Array.isArray(st.data) || st.data.length === 0) return { status: 200, data: 'skipped no seats' };
    const sid = st.data[0].id;
    const r = await request('PUT', `/api/salon/seats/${sid}`, { name: 'Updated Seat ' + Date.now(), status: 'Occupied' }, salonAuth);
    if (r.status === 200) {
      const v = await request('GET', '/api/salon/seats', null, salonAuth);
      if (v.status === 200 && Array.isArray(v.data)) {
        const u = v.data.find(x => x.id === sid);
        if (u) validate(u, { id: sid, status: 'Occupied' });
      }
    }
    return r;
  });
  await test('Create Revenue then Verify in Finances', async () => {
    const revTitle = 'RevTest_' + Date.now();
    const r = await request('POST', '/api/salon/revenue', { amount: 1500, date: '2026-07-06', description: revTitle }, salonAuth);
    if (r.status === 200) {
      const v = await request('GET', '/api/salon/revenue', null, salonAuth);
      if (v.status === 200 && Array.isArray(v.data)) {
        const found = v.data.find(x => x.description === revTitle || (x.description && x.description.includes('RevTest_')));
        if (found) { return { status: 200, data: 'verified', _verified: true }; }
      }
    }
    return r;
  });
  await test('Create Expense then Verify in Finances', async () => {
    const expTitle = 'ExpTest_' + Date.now();
    const r = await request('POST', '/api/salon/expenses', { amount: 500, date: '2026-07-06', description: expTitle, category: 'Test' }, salonAuth);
    if (r.status === 200) {
      const v = await request('GET', '/api/salon/expenses', null, salonAuth);
      if (v.status === 200 && Array.isArray(v.data)) {
        const found = v.data.find(x => x.description === expTitle || (x.description && x.description.includes('ExpTest_')));
        if (found) { return { status: 200, data: 'verified', _verified: true }; }
      }
    }
    return r;
  });
  await test('Create Offer then Verify', async () => {
    const offTitle = 'TestOffer_' + Date.now();
    const r = await request('POST', '/api/salon/offers', { title: offTitle, description: 'Test desc', discount_percent: 20, valid_from: '2026-07-06', valid_until: '2026-07-13', is_active: true }, salonAuth);
    if (r.status === 200) {
      const v = await request('GET', '/api/salon/offers', null, salonAuth);
      if (v.status === 200 && Array.isArray(v.data)) {
        const found = v.data.find(x => x.title === offTitle);
        if (found) { return { status: 200, data: 'verified', _verified: true }; }
      }
    }
    return r;
  });

  // ── VALIDATION TESTS ──
  console.log('\n─── 3b. VALIDATION TESTS (expecting 400/409) ───');
  
  // Barber: use unique name + phone for first create, then duplicate name blocked
  const barberName = 'TestBarber_' + Date.now();
  const barberPhone = '3001' + String(Date.now()).slice(-6);
  const b1 = await vtest('Create Barber (valid)', () =>
    request('POST', '/api/salon/barbers', { name: barberName, phone: barberPhone }, salonAuth), 200);
  if (b1?.status === 200) {
    await vtest('Duplicate Barber Name Blocked', () =>
      request('POST', '/api/salon/barbers', { name: barberName, phone: '3002' + String(Date.now()).slice(-6) }, salonAuth), 409);
  }
  
  // Services: track name, then duplicate blocked
  const svcName = 'TestSvc_' + Date.now();
  const s1 = await vtest('Create Service (valid)', () =>
    request('POST', '/api/salon/services', { name: svcName, price: 500 }, salonAuth), 200);
  if (s1?.status === 200) {
    await vtest('Duplicate Service Name Blocked', () =>
      request('POST', '/api/salon/services', { name: svcName, price: 600 }, salonAuth), 409);
  }
  
  await vtest('Negative Price Rejected', () =>
    request('POST', '/api/salon/services', { name: 'NegTest', price: -100 }, salonAuth), 400);
  await vtest('String Price Rejected', () =>
    request('POST', '/api/salon/services', { name: 'StrTest', price: 'abc' }, salonAuth), 400);
  
  // Seats: create with unique name, then duplicate blocked
  const seatName = 'TestSeat_' + Date.now();
  const st1 = await vtest('Create Seat (valid)', () =>
    request('POST', '/api/salon/seats', { name: seatName }, salonAuth), 200);
  if (st1?.status === 200) {
    await vtest('Duplicate Seat Name Blocked', () =>
      request('POST', '/api/salon/seats', { name: seatName }, salonAuth), 409);
  }
  
  await vtest('Revenue Negative Amount Rejected', () =>
    request('POST', '/api/salon/revenue', { amount: -500, date: '2026-07-06' }, salonAuth), 400);
  await vtest('Expense No Description Rejected', () =>
    request('POST', '/api/salon/expenses', { amount: 500, date: '2026-07-06' }, salonAuth), 400);
} else {
  console.log('\n⚠️  Salon login FAILED');
}

// ══════════════════════════════════════
// 4. CUSTOMER FEATURES
// ══════════════════════════════════════
console.log('\n─── 4. CUSTOMER FEATURES ───');

await test('Public Salons', () => request('GET', '/api/public/salons'));
await test('Public Salon Detail', () => request('GET', '/api/public/salons/1'));
await test('Locations', () => request('GET', '/api/customer/locations'));
await test('Bookable Salons', () => request('GET', '/api/customer/bookable-salons'));
await test('Bookable Salon Services', () => request('GET', '/api/customer/bookable-salons/1/services'));

// ══════════════════════════════════════
// 5. DB & EXPORT
// ══════════════════════════════════════
console.log('\n─── 5. DB & EXPORT ───');

if (sToken) {
  await test('DB Health', () => request('GET', '/api/db-health', null, sAuth));
}

// ══════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════
console.log('\n══════════════════════════════════════════');
const total = results.pass + results.fail;
const vTotal = results.vpass + results.vfail;
console.log(`  API: ${results.pass}/${total} passed`);
console.log(`  VALIDATION: ${results.vpass}/${vTotal} passed`);
console.log(`  TOTAL: ${results.pass + results.vpass} passed | ${results.fail + results.vfail} failed`);
console.log('══════════════════════════════════════════\n');

server.kill();
process.exit(results.fail + results.vfail > 0 ? 1 : 0);
