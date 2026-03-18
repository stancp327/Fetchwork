/*
  Warnings:

  - You are about to drop the column `smsReminderSent` on the `BookingOccurrence` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BookingOccurrence" DROP COLUMN "smsReminderSent",
ADD COLUMN     "smsReminder1hSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smsReminder24hSent" BOOLEAN NOT NULL DEFAULT false;
