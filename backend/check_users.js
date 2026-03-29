const { pool } = require('./config/database');
(async () => {
  const r = await pool.query(
    'SELECT u.id, u.username, r.role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id'
  );
  console.log(JSON.stringify(r.rows, null, 2));
  process.exit();
})();
