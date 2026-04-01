/**
 * AES-256-GCM Encryption Utility for API Keys & Sensitive Data
 * 
 * Uses AES-256-GCM authenticated encryption:
 * - 256-bit key derived from ENCRYPTION_KEY env var
 * - Random 12-byte IV per encryption
 * - 16-byte auth tag for integrity verification
 * - Output format: iv:authTag:ciphertext (all hex-encoded)
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;   // GCM standard
const TAG_LENGTH = 16;  // 128-bit auth tag
const ENCODING = 'hex';

/**
 * Get the 256-bit encryption key from environment.
 * Falls back to a derived key from JWT_SECRET if ENCRYPTION_KEY is not set.
 */
function getKey() {
  const raw = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!raw) {
    throw new Error('ENCRYPTION_KEY or JWT_SECRET must be set for API key encryption');
  }
  // Derive a consistent 32-byte key using SHA-256
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * @param {string} plaintext - The text to encrypt
 * @returns {string} Encrypted string in format "iv:authTag:ciphertext"
 */
function encrypt(plaintext) {
  if (!plaintext || plaintext.trim() === '') return '';

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', ENCODING);
  encrypted += cipher.final(ENCODING);
  const authTag = cipher.getAuthTag().toString(ENCODING);

  return `${iv.toString(ENCODING)}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 * @param {string} encryptedStr - The encrypted string in format "iv:authTag:ciphertext"
 * @returns {string} Decrypted plaintext
 */
function decrypt(encryptedStr) {
  if (!encryptedStr || encryptedStr.trim() === '') return '';

  // If the value doesn't look encrypted (no colons), return as-is (backward compat with plaintext)
  if (!encryptedStr.includes(':')) {
    return encryptedStr;
  }

  const parts = encryptedStr.split(':');
  if (parts.length !== 3) {
    // Not our format, return as-is
    return encryptedStr;
  }

  try {
    const key = getKey();
    const iv = Buffer.from(parts[0], ENCODING);
    const authTag = Buffer.from(parts[1], ENCODING);
    const ciphertext = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, ENCODING, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // If decryption fails (e.g., key changed, corrupted data), return empty
    console.error('[Encryption] Decryption failed — data may be corrupted or key changed:', err.message);
    return '';
  }
}

/**
 * Mask a value for display (show first 4 and last 4 chars).
 * @param {string} value 
 * @returns {string}
 */
function mask(value) {
  if (!value || value.length < 10) return value ? '••••••••' : '';
  return value.substring(0, 4) + '••••••••' + value.substring(value.length - 4);
}

module.exports = { encrypt, decrypt, mask };
