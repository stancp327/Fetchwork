import type { Prisma } from '../../generated/prisma';
import { prisma } from './client';

export async function withTx<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction((tx) => fn(tx));
}
