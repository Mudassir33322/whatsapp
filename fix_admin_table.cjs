const mysql = require('mysql2/promise');
async function main() {
  const c = await mysql.createConnection({host:'localhost',user:'root',password:'',database:'autozap_platform'});
  try { await c.execute("ALTER TABLE admins ADD COLUMN IF NOT EXISTS last_login TIMESTAMP NULL AFTER is_active"); console.log('OK: last_login'); } catch(e) { console.log('SKIP last_login:', e.message); }
  try { await c.execute("ALTER TABLE admins ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER last_login"); console.log('OK: updated_at'); } catch(e) { console.log('SKIP updated_at:', e.message); }
  await c.end();
}
main().catch(e => console.error(e.message));
