const mysql = require('mysql2/promise');
(async () => {
  try {
    const c = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || ''
    });
    console.log('MYSQL_OK');
    await c.end();
    process.exit(0);
  } catch (e) {
    console.log('MYSQL_FAIL:' + e.message);
    process.exit(1);
  }
})();
