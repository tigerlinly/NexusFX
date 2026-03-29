const express = require('express');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { pool } = require('../config/database');
const { authMiddleware, auditLog } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);

// =============================================
// STEP 1: Generate MFA secret + QR code
// =============================================
/**
 * @swagger
 * /mfa/setup:
 *   post:
 *     summary: Generate MFA secret and QR code for setup
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: QR code data URL and secret
 */
router.post('/setup', async (req, res) => {
  try {
    // Check if MFA is already enabled
    const user = await pool.query(
      'SELECT mfa_enabled, username, email FROM users WHERE id = $1',
      [req.user.id]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.rows[0].mfa_enabled) {
      return res.status(400).json({ error: 'MFA is already enabled. Disable it first to reconfigure.' });
    }

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `NexusFX (${user.rows[0].email})`,
      issuer: 'NexusFX Trading Platform',
      length: 20,
    });

    // Store secret temporarily (not enabled yet until verified)
    await pool.query(
      'UPDATE users SET mfa_secret = $1 WHERE id = $2',
      [secret.base32, req.user.id]
    );

    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      secret: secret.base32,
      qr_code: qrDataUrl,
      otpauth_url: secret.otpauth_url,
      message: 'Scan QR code with Google Authenticator or Authy, then verify with a code.',
    });
  } catch (err) {
    console.error('MFA setup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// STEP 2: Verify and enable MFA
// =============================================
/**
 * @swagger
 * /mfa/verify:
 *   post:
 *     summary: Verify TOTP code and enable MFA
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, description: "6-digit TOTP code from authenticator app" }
 *     responses:
 *       200:
 *         description: MFA enabled successfully
 */
router.post('/verify', auditLog('ENABLE_MFA', 'USER'), async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    // Get user's secret
    const user = await pool.query(
      'SELECT mfa_secret, mfa_enabled FROM users WHERE id = $1',
      [req.user.id]
    );

    if (user.rows.length === 0 || !user.rows[0].mfa_secret) {
      return res.status(400).json({ error: 'Please run /mfa/setup first' });
    }

    if (user.rows[0].mfa_enabled) {
      return res.status(400).json({ error: 'MFA is already enabled' });
    }

    // Verify the TOTP code
    const verified = speakeasy.totp.verify({
      secret: user.rows[0].mfa_secret,
      encoding: 'base32',
      token: code,
      window: 2, // Allow 2 intervals (60 seconds) of drift
    });

    if (!verified) {
      return res.status(401).json({ error: 'Invalid verification code. Try again.' });
    }

    // Enable MFA
    await pool.query(
      'UPDATE users SET mfa_enabled = true WHERE id = $1',
      [req.user.id]
    );

    res.json({ success: true, message: 'MFA enabled successfully! You will need to enter a code on every login.' });
  } catch (err) {
    console.error('MFA verify error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// STEP 3: Disable MFA
// =============================================
router.post('/disable', auditLog('DISABLE_MFA', 'USER'), async (req, res) => {
  try {
    const { code, password } = req.body;

    // Require current TOTP code to disable (security)
    const user = await pool.query(
      'SELECT mfa_secret, mfa_enabled, password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!user.rows[0].mfa_enabled) {
      return res.status(400).json({ error: 'MFA is not enabled' });
    }

    // Verify TOTP code
    if (code) {
      const verified = speakeasy.totp.verify({
        secret: user.rows[0].mfa_secret,
        encoding: 'base32',
        token: code,
        window: 2,
      });

      if (!verified) {
        return res.status(401).json({ error: 'Invalid verification code' });
      }
    } else {
      // If no code, require password
      if (!password) {
        return res.status(400).json({ error: 'Either TOTP code or password required to disable MFA' });
      }
      const bcrypt = require('bcryptjs');
      const valid = await bcrypt.compare(password, user.rows[0].password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid password' });
      }
    }

    // Disable MFA
    await pool.query(
      'UPDATE users SET mfa_enabled = false, mfa_secret = NULL WHERE id = $1',
      [req.user.id]
    );

    res.json({ success: true, message: 'MFA has been disabled.' });
  } catch (err) {
    console.error('MFA disable error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/mfa/status — check MFA status
router.get('/status', async (req, res) => {
  try {
    const user = await pool.query(
      'SELECT mfa_enabled FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json({ mfa_enabled: user.rows[0]?.mfa_enabled || false });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
