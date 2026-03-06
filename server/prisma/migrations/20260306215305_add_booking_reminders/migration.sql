-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('email', 'push', 'sms');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('scheduled', 'sent', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "BookingReminder" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "occurrenceId" UUID NOT NULL,
    "recipientId" TEXT NOT NULL,
    "recipientRole" TEXT NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "reminderType" TEXT NOT NULL,
    "scheduledFor" TIMESTAMPTZ(6) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'scheduled',
    "sentAt" TIMESTAMPTZ(6),
    "failReason" TEXT,
    "contentJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "BookingReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingReminder_status_scheduledFor_idx" ON "BookingReminder"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "BookingReminder_bookingId_idx" ON "BookingReminder"("bookingId");

-- CreateIndex
CREATE INDEX "BookingReminder_occurrenceId_idx" ON "BookingReminder"("occurrenceId");

-- CreateIndex
CREATE INDEX "BookingReminder_recipientId_status_idx" ON "BookingReminder"("recipientId", "status");
