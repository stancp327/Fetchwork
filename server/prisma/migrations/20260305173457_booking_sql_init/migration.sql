-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending_payment', 'held', 'confirmed', 'in_progress', 'completed', 'cancelled_by_client', 'cancelled_by_freelancer', 'no_show_client', 'no_show_freelancer', 'disputed', 'resolved');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('client', 'freelancer', 'admin', 'system');

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "bookingRef" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "serviceOfferingId" UUID,
    "policySnapshotJson" JSONB NOT NULL,
    "pricingSnapshotJson" JSONB NOT NULL,
    "currentState" "BookingStatus" NOT NULL DEFAULT 'pending_payment',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingOccurrence" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "occurrenceNo" INTEGER NOT NULL DEFAULT 1,
    "clientId" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "startAtUtc" TIMESTAMPTZ(6) NOT NULL,
    "endAtUtc" TIMESTAMPTZ(6) NOT NULL,
    "timezone" TEXT NOT NULL,
    "localStartWallclock" TEXT NOT NULL,
    "localEndWallclock" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'held',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "BookingOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" BIGSERIAL NOT NULL,
    "bookingId" UUID NOT NULL,
    "occurrenceId" UUID,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" BIGSERIAL NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseJson" JSONB NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeRecord" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "occurrenceId" UUID,
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "platformFeeCents" INTEGER NOT NULL DEFAULT 0,
    "payoutAmountCents" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT 'none',
    "idempotencyKey" TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ChargeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" UUID NOT NULL,
    "occurrenceId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "clientCheckinAt" TIMESTAMPTZ(6),
    "freelancerCheckinAt" TIMESTAMPTZ(6),
    "clientCheckoutAt" TIMESTAMPTZ(6),
    "freelancerCheckoutAt" TIMESTAMPTZ(6),
    "clientCheckinMeta" JSONB,
    "freelancerCheckinMeta" JSONB,
    "disputeFlag" BOOLEAN NOT NULL DEFAULT false,
    "adminAdjustmentJson" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingRef_key" ON "Booking"("bookingRef");

-- CreateIndex
CREATE INDEX "Booking_clientId_createdAt_idx" ON "Booking"("clientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Booking_freelancerId_createdAt_idx" ON "Booking"("freelancerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BookingOccurrence_freelancerId_startAtUtc_idx" ON "BookingOccurrence"("freelancerId", "startAtUtc");

-- CreateIndex
CREATE INDEX "BookingOccurrence_clientId_startAtUtc_idx" ON "BookingOccurrence"("clientId", "startAtUtc");

-- CreateIndex
CREATE INDEX "BookingOccurrence_status_startAtUtc_idx" ON "BookingOccurrence"("status", "startAtUtc");

-- CreateIndex
CREATE UNIQUE INDEX "BookingOccurrence_bookingId_occurrenceNo_key" ON "BookingOccurrence"("bookingId", "occurrenceNo");

-- CreateIndex
CREATE INDEX "AuditEvent_bookingId_createdAt_idx" ON "AuditEvent"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_occurrenceId_createdAt_idx" ON "AuditEvent"("occurrenceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_eventType_createdAt_idx" ON "AuditEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "IdempotencyKey_createdAt_idx" ON "IdempotencyKey"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_idempotencyKey_route_actorId_key" ON "IdempotencyKey"("idempotencyKey", "route", "actorId");

-- CreateIndex
CREATE UNIQUE INDEX "ChargeRecord_stripePaymentIntentId_key" ON "ChargeRecord"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "ChargeRecord_stripeChargeId_key" ON "ChargeRecord"("stripeChargeId");

-- CreateIndex
CREATE INDEX "ChargeRecord_bookingId_createdAt_idx" ON "ChargeRecord"("bookingId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ChargeRecord_occurrenceId_createdAt_idx" ON "ChargeRecord"("occurrenceId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_occurrenceId_key" ON "AttendanceRecord"("occurrenceId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_status_idx" ON "AttendanceRecord"("status");

-- AddForeignKey
ALTER TABLE "BookingOccurrence" ADD CONSTRAINT "BookingOccurrence_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "BookingOccurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeRecord" ADD CONSTRAINT "ChargeRecord_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeRecord" ADD CONSTRAINT "ChargeRecord_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "BookingOccurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "BookingOccurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
