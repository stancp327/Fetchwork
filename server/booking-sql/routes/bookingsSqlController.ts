import type { Request, Response } from 'express';

export async function getSlotsSql(_req: Request, res: Response) {
  return res.status(501).json({ error: 'SQL slots path not implemented yet' });
}

export async function createBookingHoldSql(_req: Request, res: Response) {
  return res.status(501).json({ error: 'SQL hold path not implemented yet' });
}

export async function confirmBookingSql(_req: Request, res: Response) {
  return res.status(501).json({ error: 'SQL confirm path not implemented yet' });
}
