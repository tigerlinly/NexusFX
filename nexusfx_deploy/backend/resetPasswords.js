require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./config/database');

async function resetAllPasswords() {
  try {
    const defaultPassword = '123456';
    console.log(`Hashing password '${defaultPassword}'...`);
    
    const hash = await bcrypt.hash(defaultPassword, 12);
    
    console.log(`Connecting to DB to update all users...`);
    const res = await pool.query('UPDATE users SET password_hash = $1', [hash]);
    
    console.log(`Done! Successfully updated ${res.rowCount} users with password '${defaultPassword}'.`);
  } catch (err) {
    console.error('Error updating passwords:', err);
  } finally {
    await pool.end();
  }
}

resetAllPasswords();
