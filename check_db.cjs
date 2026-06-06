const mysql = require('mysql2/promise');
async function main() {
  const conn = await mysql.createConnection({host:'localhost',user:'root',password:'',database:'autozap_platform'});
  const [tables] = await conn.execute("SHOW TABLES LIKE 'admins'");
  console.log('admins table exists:', tables.length > 0);
  if(tables.length > 0) {
    const [rows] = await conn.execute('SELECT id, name, email, role, password FROM admins');
    console.log('Admins found:', rows.length);
    rows.forEach(r => console.log(' -', r.id, r.name, r.email, r.role));
  }
  const [allTables] = await conn.execute("SHOW TABLES");
  console.log('\nAll tables:', allTables.map(t => Object.values(t)[0]).join(', '));
  await conn.end();
}
main().catch(e => console.error(e.message));
