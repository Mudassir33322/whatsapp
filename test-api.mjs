import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function request(method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3001, path: urlPath, method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data: safeJson(data), headers: res.headers }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function safeJson(s) { try { return JSON.parse(s); } catch { return s; } }

const server = spawn('node', ['--import', 'tsx', 'server.ts'], {
  cwd: __dirname,
  env: { ...process.env, NODE_ENV: 'development' },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverOutput = '';
server.stdout.on('data', d => { serverOutput += d.toString(); console.log('[SERVER]', d.toString().trim()); });
server.stderr.on('data', d => { console.log('[SERVER-ERR]', d.toString().trim()); });
await new Promise(r => setTimeout(r, 15000));
console.log('Server output so far:', serverOutput.substring(0, 500));

console.log('=== TEST 1: Health Check ===');
const health = await request('GET', '/api/health');
console.log(health.status, JSON.stringify(health.data));

console.log('\n=== TEST 2: Salon Login (Prime Cuts Studio) ===');
const login = await request('POST', '/api/salon/auth/login', { email: 'primecuts@salon.com', password: 'admin123' });
console.log(login.status, JSON.stringify(login.data));
const token = login.data?.token || login.data?.accessToken;

if (token) {
  const auth = { Authorization: `Bearer ${token}` };

  console.log('\n=== TEST 3: Get Dashboard ===');
  const dash = await request('GET', '/api/salon/dashboard', null, auth);
  console.log(dash.status, dash.data ? 'dashboard OK' : 'FAIL');

  console.log('\n=== TEST 4: List Barbers ===');
  const barbers = await request('GET', '/api/salon/barbers', null, auth);
  console.log(barbers.status, JSON.stringify(barbers.data?.map?.(b => ({ id: b.id, name: b.name })) || barbers.data));

  console.log('\n=== TEST 5: List Services ===');
  const services = await request('GET', '/api/salon/services', null, auth);
  console.log(services.status, JSON.stringify(services.data?.map?.(s => ({ id: s.id, name: s.name, price: s.price })) || services.data));

  console.log('\n=== TEST 6: List Appointments ===');
  const apps = await request('GET', '/api/salon/appointments', null, auth);
  console.log(apps.status, JSON.stringify(apps.data?.map?.(a => ({ id: a.id, date: a.appointment_date, time: a.appointment_time, status: a.status })) || apps.data));

  console.log('\n=== TEST 7: List Products ===');
  const prods = await request('GET', '/api/salon/products', null, auth);
  console.log(prods.status, JSON.stringify(prods.data?.map?.(p => ({ id: p.id, name: p.name, price: p.price })) || prods.data));

  console.log('\n=== TEST 8: List Customers ===');
  const custs = await request('GET', '/api/salon/customers', null, auth);
  console.log(custs.status, JSON.stringify(custs.data?.map?.(c => ({ phone: c.phone, name: c.name, visits: c.visit_count })) || custs.data));

  console.log('\n=== TEST 9: Analytics ===');
  const analytics = await request('GET', '/api/salon/analytics?period=7d', null, auth);
  console.log(analytics.status, analytics.data ? 'analytics OK' : 'FAIL');

  console.log('\n=== TEST 10: Working Hours ===');
  const wh = await request('GET', '/api/salon/working-hours', null, auth);
  console.log(wh.status, Array.isArray(wh.data) ? `${wh.data.length} entries` : 'FAIL');

  console.log('\n=== TEST 11: Shop Settings ===');
  const shop = await request('GET', '/api/salon/shop/settings', null, auth);
  console.log(shop.status, JSON.stringify(shop.data));

  console.log('\n=== TEST 12: Duplicate Barber Check ===');
  const dupBarber = await request('POST', '/api/salon/barbers', { name: 'Ali', phone: '0300-0000000' }, auth);
  console.log('Create first:', dupBarber.status, JSON.stringify(dupBarber.data));
  const dupBarber2 = await request('POST', '/api/salon/barbers', { name: 'Ali', phone: '0300-1111111' }, auth);
  console.log('Create duplicate:', dupBarber2.status, JSON.stringify(dupBarber2.data));

  console.log('\n=== TEST 13: Duplicate Service Check ===');
  const dupSvc1 = await request('POST', '/api/salon/services', { name: 'Haircut', price: 500, duration: 30 }, auth);
  console.log('Create first:', dupSvc1.status, JSON.stringify(dupSvc1.data));
  const dupSvc2 = await request('POST', '/api/salon/services', { name: 'Haircut', price: 600, duration: 30 }, auth);
  console.log('Create duplicate:', dupSvc2.status, JSON.stringify(dupSvc2.data));

  console.log('\n=== TEST 14: Invalid Price Validation ===');
  const badPrice = await request('POST', '/api/salon/services', { name: 'Test', price: -100 }, auth);
  console.log('Negative price:', badPrice.status, JSON.stringify(badPrice.data));
  const badPrice2 = await request('POST', '/api/salon/services', { name: 'Test2', price: 'abc' }, auth);
  console.log('String price:', badPrice2.status, JSON.stringify(badPrice2.data));
} else {
  console.log('\n❌ LOGIN FAILED - cannot proceed');
}

console.log('\n=== TESTS COMPLETE ===');
server.kill();
process.exit(0);
