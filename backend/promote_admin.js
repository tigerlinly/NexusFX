const { pool } = require('./config/database');
(async () => {
  const r = await pool.query("SELECT id FROM roles WHERE role_name = 'admin'");
  if (r.rows.length > 0) {
    // Promote user 'tiger' to admin
    await pool.query('UPDATE users SET role_id = $1 WHERE username = $2', [r.rows[0].id, 'tiger']);
    console.log('✅ User tiger promoted to admin');
    
    // Also promote 'admin' user
    await pool.query('UPDATE users SET role_id = $1 WHERE username = $2', [r.rows[0].id, 'admin']);
    console.log('✅ User admin promoted to admin');
  }
  
  // Verify
  const users = await pool.query(
    'SELECT u.id, u.username, r.role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id'
  );
  console.log('Users:', JSON.stringify(users.rows, null, 2));
  process.exit();
})();
