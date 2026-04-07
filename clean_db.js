const { pool } = require('./backend/config/database');
pool.query("DELETE FROM system_config WHERE category = 'trading'")
  .then(res => {
    console.log('Deleted rows:', res.rowCount);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
