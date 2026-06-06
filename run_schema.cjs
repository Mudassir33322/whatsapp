const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, 'setup_missing.sql'), 'utf8');
  const statements = sql.split(';').filter(s => s.trim());
  
  const c = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'autozap_platform',
    multipleStatements: true
  });

  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (!trimmed) continue;
    try {
      await c.query(trimmed);
      console.log('OK:', trimmed.slice(0, 60) + '...');
    } catch (e) {
      console.log('SKIP:', e.message.slice(0, 80));
    }
  }

  await c.end();
  console.log('\nDone!');
}

run().catch(e => console.error('FATAL:', e));
