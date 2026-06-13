-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMPTZ(6),
ADD COLUMN     "cancelledById" TEXT;
