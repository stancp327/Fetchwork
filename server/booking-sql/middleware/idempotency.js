const crypto = require('crypto');

function buildRequestHash(req) {
  const payload = JSON.stringify({
    method: req.method,
    path: req.path,
    body: req.body || {},
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function requireIdempotencyKey(req, res, next) {
  const key = req.header('Idempotency-Key');
  if (!key) {
    return res.status(400).json({ error: 'Idempotency-Key header is required', code: 'MISSING_IDEMPOTENCY_KEY' });
  }
  req.idempotencyKey = key;
  req.requestHash = buildRequestHash(req);
  next();
}

module.exports = { buildRequestHash, requireIdempotencyKey };
