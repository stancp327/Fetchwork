import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export function buildRequestHash(req: Request): string {
  const payload = JSON.stringify({
    method: req.method,
    path: req.path,
    body: req.body || {},
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export function requireIdempotencyKey(req: Request, res: Response, next: NextFunction) {
  const key = req.header('Idempotency-Key');
  if (!key) {
    return res.status(400).json({ error: 'Idempotency-Key header is required', code: 'MISSING_IDEMPOTENCY_KEY' });
  }
  (req as any).idempotencyKey = key;
  (req as any).requestHash = buildRequestHash(req);
  next();
}
