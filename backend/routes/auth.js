const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { authMiddleware, auditLog } = require('../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication & user management
 *   - name: Dashboard
 *     description: Dashboard data & widgets
 *   - name: Trades
 *     description: Trade execution & history
 *   - name: Accounts
 *     description: Trading account management
 *   - name: Groups
 *     description: Team/group management
 *   - name: Wallet
 *     description: Wallet & financial transactions 
 *   - name: Bots
 *     description: Trading bot management
 *   - name: Reports
 *     description: Reports & analytics
 *   - name: Billing
 *     description: Subscription & billing
 *   - name: Settings
 *     description: User settings & configuration
 *   - name: Admin
 *     description: Admin panel operations
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user account
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               display_name: { type: string }
 *     responses:
 *       201:
 *         description: User registered successfully
 *       409:
 *         description: Username or email already exists
 */
// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, display_name, invite_code } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email, password required' });
    }

    // Password complexity validation
    if (password.length < 8) {
      return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' });
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'รหัสผ่านต้องมีตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลขอย่างน้อยอย่างละ 1 ตัว' });
    }

    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    // Validate invite code if provided
    let tenantId = null;
    if (invite_code) {
      const inviteResult = await pool.query(
        `SELECT * FROM agent_invitations
         WHERE invite_code = $1 AND is_active = true AND expires_at > NOW()
           AND (max_uses = 0 OR used_count < max_uses)`,
        [invite_code]
      );
      if (inviteResult.rows.length === 0) {
        return res.status(400).json({ error: 'ลิงก์เชิญไม่ถูกต้องหรือหมดอายุแล้ว' });
      }
      tenantId = inviteResult.rows[0].tenant_id;

      // Check tenant member limit
      const memberCount = await pool.query(
        `SELECT COUNT(*) as count FROM users WHERE tenant_id = $1`,
        [tenantId]
      );
      const tenantInfo = await pool.query(`SELECT max_users FROM tenants WHERE id = $1`, [tenantId]);
      if (tenantInfo.rows.length > 0 && parseInt(memberCount.rows[0].count) >= tenantInfo.rows[0].max_users) {
        return res.status(400).json({ error: 'ทีมมีสมาชิกเต็มแล้ว' });
      }
    }

    // Get default 'user' role
    const roleResult = await pool.query("SELECT id FROM roles WHERE role_name = 'user'");
    const roleId = roleResult.rows.length > 0 ? roleResult.rows[0].id : null;

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, display_name, role_id, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, email, display_name`,
      [username, email, hash, display_name || username, roleId, tenantId]
    );

    const user = result.rows[0];

    // Update invite used count
    if (invite_code) {
      await pool.query(
        `UPDATE agent_invitations SET used_count = used_count + 1 WHERE invite_code = $1`,
        [invite_code]
      );
    }

    // Create default settings
    await pool.query('INSERT INTO user_settings (user_id) VALUES ($1)', [user.id]);

    // Create default wallet
    await pool.query(
      'INSERT INTO wallets (user_id, currency, balance) VALUES ($1, $2, $3)',
      [user.id, 'USD', 0]
    );

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Audit log
    const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, ip_address, details) VALUES ($1, $2, $3, $4, $5)`,
      [user.id, 'user.register', 'user', ip, JSON.stringify({ invite_code: invite_code || null, tenant_id: tenantId })]
    );

    res.status(201).json({ user: { ...user, role: 'user' }, token });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login with username/email and password
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string, description: 'Username or email' }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password, mfa_code } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password required' });
    }

    const result = await pool.query(
      `SELECT u.*, r.role_name 
       FROM users u 
       LEFT JOIN roles r ON r.id = u.role_id 
       WHERE (u.username = $1 OR u.email = $1) AND u.is_active = true`,
      [username]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้/อีเมล หรือรหัสผ่านไม่ถูกต้อง' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้/อีเมล หรือรหัสผ่านไม่ถูกต้อง' });
    }

    // 🔐 MFA CHECK: If MFA is enabled, require TOTP code
    if (user.mfa_enabled && user.mfa_secret) {
      if (!mfa_code) {
        // First step: credentials OK, but need MFA code
        return res.status(200).json({
          mfa_required: true,
          message: 'กรุณากรอกรหัส 2FA จากแอป Authenticator ของคุณ',
        });
      }

      // Verify TOTP code
      const speakeasy = require('speakeasy');
      const mfaValid = speakeasy.totp.verify({
        secret: user.mfa_secret,
        encoding: 'base32',
        token: mfa_code,
        window: 2,
      });

      if (!mfaValid) {
        return res.status(401).json({ error: 'รหัส 2FA ไม่ถูกต้อง กรุณาลองใหม่' });
      }
    }

    // Update last login
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role_name || 'user' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Audit log
    const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, ip_address) VALUES ($1, $2, $3, $4)`,
      [user.id, 'user.login', 'user', ip]
    );

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        role: user.role_name || 'user',
        mfa_enabled: user.mfa_enabled || false,
      },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current authenticated user profile
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: User profile data
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.display_name, u.avatar_url,
              r.role_name as role,
              s.theme_id, s.custom_colors, s.language, s.timezone,
              s.notifications_enabled, s.sound_enabled
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN user_settings s ON s.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const userRes = await pool.query('SELECT id FROM users WHERE email = $1 AND is_active = true', [email]);
    if (userRes.rows.length === 0) {
      // Return 200 anyway for security (don't reveal if email exists)
      return res.json({ message: 'If an account exists, a reset link was sent.' });
    }

    const userId = userRes.rows[0].id;
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetToken, expires, userId]
    );

    // MOCK SEND EMAIL: In a real app we'd trigger NodeMailer here.
    console.log(`\n============================`);
    console.log(`📧 MOCK EMAIL SENT TO: ${email}`);
    console.log(`Reset Link: http://localhost:5173/reset-password?token=${resetToken}`);
    console.log(`============================\n`);

    res.json({ message: 'If an account exists, a reset link was sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });

    const userRes = await pool.query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );

    if (userRes.rows.length === 0) {
      return res.status(400).json({ error: 'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้อง หรือหมดอายุแล้ว' });
    }

    const userId = userRes.rows[0].id;
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [passwordHash, userId]
    );

    res.json({ message: 'รหัสผ่านของคุณถูกเปลี่ยนเรียบร้อยแล้ว' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
