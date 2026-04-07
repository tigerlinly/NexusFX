require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/config/database');

const categories = ['trading', 'infrastructure', 'cicd', 'monitoring'];
pool.query("DELETE FROM system_config WHERE category = ANY($1::text[])", [categories])
  .then(res => {
    console.log('Deleted rows:', res.rowCount);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error cleaning DB:', err.message);
    process.exit(1);
  });
