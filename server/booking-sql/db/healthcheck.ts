import { prisma } from './client';

export async function bookingSqlHealthcheck(): Promise<{ ok: boolean; error?: string }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'unknown db error' };
  }
}
