const mysql = require('mysql2/promise');
(async () => {
  try {
    const c = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: ''
    });
    await c.execute('CREATE DATABASE IF NOT EXISTS autozap_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    console.log('DB_OK');
    await c.end();
    process.exit(0);
  } catch (e) {
    console.log('DB_FAIL:' + e.message);
    process.exit(1);
  }
})();
