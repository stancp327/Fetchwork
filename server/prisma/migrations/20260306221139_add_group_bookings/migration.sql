-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('waiting', 'promoted', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('held', 'confirmed', 'cancelled', 'no_show');

-- CreateTable
CREATE TABLE "GroupBookingSlot" (
    "id" UUID NOT NULL,
    "serviceId" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "startAtUtc" TIMESTAMPTZ(6) NOT NULL,
    "endAtUtc" TIMESTAMPTZ(6) NOT NULL,
    "timezone" TEXT NOT NULL,
    "totalCapacity" INTEGER NOT NULL DEFAULT 10,
    "bookedCount" INTEGER NOT NULL DEFAULT 0,
    "pricePerPersonCents" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFull" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "GroupBookingSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupParticipant" (
    "id" UUID NOT NULL,
    "slotId" UUID NOT NULL,
    "clientId" TEXT NOT NULL,
    "bookingId" UUID,
    "seatCount" INTEGER NOT NULL DEFAULT 1,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'held',
    "holdExpiresAt" TIMESTAMPTZ(6),
    "paidAmountCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "GroupParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" UUID NOT NULL,
    "slotId" UUID NOT NULL,
    "clientId" TEXT NOT NULL,
    "seatCount" INTEGER NOT NULL DEFAULT 1,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'waiting',
    "position" INTEGER NOT NULL,
    "joinedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promotedAt" TIMESTAMPTZ(6),
    "promotionExpiresAt" TIMESTAMPTZ(6),
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyPush" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupBookingSlot_freelancerId_date_idx" ON "GroupBookingSlot"("freelancerId", "date");

-- CreateIndex
CREATE INDEX "GroupBookingSlot_serviceId_startAtUtc_idx" ON "GroupBookingSlot"("serviceId", "startAtUtc");

-- CreateIndex
CREATE INDEX "GroupBookingSlot_isFull_startAtUtc_idx" ON "GroupBookingSlot"("isFull", "startAtUtc");

-- CreateIndex
CREATE UNIQUE INDEX "GroupBookingSlot_serviceId_date_startTime_key" ON "GroupBookingSlot"("serviceId", "date", "startTime");

-- CreateIndex
CREATE INDEX "GroupParticipant_clientId_status_idx" ON "GroupParticipant"("clientId", "status");

-- CreateIndex
CREATE INDEX "GroupParticipant_slotId_status_idx" ON "GroupParticipant"("slotId", "status");

-- CreateIndex
CREATE INDEX "GroupParticipant_holdExpiresAt_idx" ON "GroupParticipant"("holdExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "GroupParticipant_slotId_clientId_key" ON "GroupParticipant"("slotId", "clientId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_slotId_status_position_idx" ON "WaitlistEntry"("slotId", "status", "position");

-- CreateIndex
CREATE INDEX "WaitlistEntry_clientId_status_idx" ON "WaitlistEntry"("clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_slotId_clientId_key" ON "WaitlistEntry"("slotId", "clientId");

-- AddForeignKey
ALTER TABLE "GroupParticipant" ADD CONSTRAINT "GroupParticipant_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "GroupBookingSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "GroupBookingSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
