/**
 * Email Validation Middleware
 * Checks:
 * 1. Disposable/temp email domains (e.g. mailinator, guerrillamail)
 * 2. MX record existence — domain must be able to receive email
 */

const dns = require('dns').promises;
const disposableDomains = require('disposable-email-domains');

const disposableSet = new Set(disposableDomains);

// Cache MX lookups to avoid hammering DNS on every request
const mxCache = new Map(); // domain → { valid: bool, cachedAt: timestamp }
const MX_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function hasMxRecord(domain) {
  const cached = mxCache.get(domain);
  if (cached && Date.now() - cached.cachedAt < MX_CACHE_TTL) {
    return cached.valid;
  }
  try {
    const records = await dns.resolveMx(domain);
    const valid = Array.isArray(records) && records.length > 0;
    mxCache.set(domain, { valid, cachedAt: Date.now() });
    return valid;
  } catch {
    mxCache.set(domain, { valid: false, cachedAt: Date.now() });
    return false;
  }
}

/**
 * validateEmailDomain(email) → { valid: boolean, reason?: string }
 * Use this in route handlers or as a custom express-validator check.
 */
async function validateEmailDomain(email) {
  if (!email || !email.includes('@')) {
    return { valid: false, reason: 'Invalid email format' };
  }

  const domain = email.split('@')[1].toLowerCase();

  if (disposableSet.has(domain)) {
    return { valid: false, reason: 'Disposable email addresses are not allowed' };
  }

  const hasMx = await hasMxRecord(domain);
  if (!hasMx) {
    return { valid: false, reason: 'Email domain does not appear to accept mail' };
  }

  return { valid: true };
}

/**
 * Express middleware — validates email in req.body.email
 * Returns 400 if invalid. Call after express-validator's isEmail().
 */
async function emailDomainMiddleware(req, res, next) {
  const email = req.body.email;
  if (!email) return next();

  try {
    const result = await validateEmailDomain(email);
    if (!result.valid) {
      return res.status(400).json({ error: result.reason });
    }
    next();
  } catch (err) {
    // Don't block signup on DNS errors — degrade gracefully
    console.warn('[emailValidator] DNS check failed, allowing through:', err.message);
    next();
  }
}

module.exports = { validateEmailDomain, emailDomainMiddleware };
