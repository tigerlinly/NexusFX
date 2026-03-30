/**
 * Encryption utility for API keys and sensitive data
 * Uses AES-256-GCM (Authenticated Encryption)
 */
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// Derive encryption key from JWT_SECRET (or a dedicated ENCRYPTION_KEY env var)
function getEncryptionKey() {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) throw new Error('No encryption key configured');
  // Derive a 32-byte key using scrypt
  return crypto.scryptSync(secret, 'nexusfx-salt-v1', 32);
}

/**
 * Check if a string looks like it's already encrypted (iv:authTag:ciphertext hex format)
 */
function isEncrypted(text) {
  if (!text || typeof text !== 'string') return false;
  const parts = text.split(':');
  if (parts.length !== 3) return false;
  // Check that all parts are valid hex strings with expected lengths
  const [iv, tag, cipher] = parts;
  return iv.length === 32 && tag.length === 32 && cipher.length > 0 && /^[0-9a-f]+$/i.test(iv) && /^[0-9a-f]+$/i.test(tag) && /^[0-9a-f]+$/i.test(cipher);
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

  // GUARD: Don't double-encrypt — if already encrypted, return as-is
  if (isEncrypted(plaintext)) {
    console.warn('[Encryption] Value appears already encrypted, skipping double-encryption');
    return plaintext;
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
 * @returns {string|null} decrypted plaintext, or null if decryption fails
 */
function decrypt(encryptedText) {
  if (!encryptedText || typeof encryptedText !== 'string' || encryptedText.trim() === '') {
    return null;
  }

  // Check if it's actually encrypted (has the iv:tag:cipher format)
  if (!isEncrypted(encryptedText)) {
    // Not encrypted (legacy plaintext), return as-is
    return encryptedText;
  }

  const parts = encryptedText.split(':');

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
    // Decryption failed — data is likely corrupted (double-encrypted or wrong key)
    console.error('[Encryption] Decryption FAILED — data may be corrupted:', err.message);
    return null; // Return null instead of corrupt data
  }
}

/**
 * Mask a string for display (show first 4 and last 4 chars)
 */
function mask(value) {
  if (!value || value.length < 10) return '••••••••';
  return value.substring(0, 4) + '••••••••' + value.substring(value.length - 4);
}

module.exports = { encrypt, decrypt, mask, isEncrypted };
