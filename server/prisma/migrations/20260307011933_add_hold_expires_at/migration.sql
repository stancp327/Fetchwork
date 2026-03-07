-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "holdExpiresAt" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "recurring_series" ALTER COLUMN "id" DROP DEFAULT;
