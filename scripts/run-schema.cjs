const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
    const c = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'autozap_platform',
      multipleStatements: true
    });
    await c.query(sql);
    console.log('SCHEMA_OK');
    await c.end();
    process.exit(0);
  } catch (e) {
    console.log('SCHEMA_FAIL:' + e.message);
    process.exit(1);
  }
})();
