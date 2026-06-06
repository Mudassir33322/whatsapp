const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
async function main() {
  const conn = await mysql.createConnection({host:'localhost',user:'root',password:'',database:'autozap_platform'});
  const hash = await bcrypt.hash('admin123', 10);
  await conn.execute(
    "INSERT INTO admins (name, email, password, role, is_active) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE password=?",
    ['Super Admin', 'admin@autozap.com', hash, 'super_admin', 1, hash]
  );
  console.log('Admin user created: admin@autozap.com / admin123');
  
  const [rows] = await conn.execute('SELECT id, name, email, role FROM admins');
  console.log('All admins:');
  rows.forEach(r => console.log(` - ${r.id}: ${r.name} <${r.email}> (${r.role})`));
  await conn.end();
}
main().catch(e => console.error(e.message));
