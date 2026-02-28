/**
 * AES-256-CBC encryption for sensitive tokens (Google Calendar refresh tokens).
 * Key: 32-byte hex string in CALENDAR_ENCRYPTION_KEY env var.
 * Falls back to plaintext in dev if key not set (logs warning once).
 */
const crypto = require('crypto');

let _warned = false;
function getKey() {
  const hex = process.env.CALENDAR_ENCRYPTION_KEY;
  if (!hex) {
    if (!_warned) {
      console.warn('⚠️  CALENDAR_ENCRYPTION_KEY not set — calendar tokens stored unencrypted');
      _warned = true;
    }
    return null;
  }
  return Buffer.from(hex, 'hex');
}

exports.encrypt = (text) => {
  if (!text) return text;
  const key = getKey();
  if (!key) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
};

exports.decrypt = (payload) => {
  if (!payload) return payload;
  const key = getKey();
  if (!key) return payload;
  try {
    const [ivHex, encHex] = payload.split(':');
    if (!ivHex || !encHex) return payload;
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(encHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
};
