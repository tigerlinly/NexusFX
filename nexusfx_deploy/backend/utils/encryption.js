/**
 * Encryption utility for API keys and sensitive data
 * Uses AES-256-GCM (Authenticated Encryption)
 */
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;

// Derive encryption key from JWT_SECRET (or a dedicated ENCRYPTION_KEY env var)
function getEncryptionKey() {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) throw new Error('No encryption key configured');
  // Derive a 32-byte key using scrypt
  return crypto.scryptSync(secret, 'nexusfx-salt-v1', 32);
}

/**
 * Encrypt a plaintext string
 * @param {string} plaintext 
 * @returns {string} encrypted string in format: iv:authTag:ciphertext (all hex)
 */
function encrypt(plaintext) {
  if (!plaintext || typeof plaintext !== 'string' || plaintext.trim() === '') {
    return plaintext; // Don't encrypt empty values
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  // Return as iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an encrypted string
 * @param {string} encryptedText - format: iv:authTag:ciphertext (all hex)
 * @returns {string} decrypted plaintext
 */
function decrypt(encryptedText) {
  if (!encryptedText || typeof encryptedText !== 'string') {
    return encryptedText;
  }

  // Check if it's actually encrypted (has the iv:tag:cipher format)
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    // Not encrypted (legacy plaintext), return as-is
    return encryptedText;
  }

  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const ciphertext = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // If decryption fails, it might be legacy plaintext containing colons
    console.warn('[Encryption] Decryption failed, returning as-is:', err.message);
    return encryptedText;
  }
}

/**
 * Mask a string for display (show first 4 and last 4 chars)
 */
function mask(value) {
  if (!value || value.length < 10) return '••••••••';
  return value.substring(0, 4) + '••••••••' + value.substring(value.length - 4);
}

module.exports = { encrypt, decrypt, mask };
