-- CreateTable
CREATE TABLE "SessionTemplate" (
    "id" UUID NOT NULL,
    "mongoServiceId" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "title" TEXT,
    "capacityType" TEXT NOT NULL DEFAULT 'GROUP',
    "scheduleType" TEXT NOT NULL DEFAULT 'FIXED_RECURRING',
    "maxCapacity" INTEGER NOT NULL DEFAULT 1,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "price" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "locationMode" TEXT,
    "locationAddress" TEXT,
    "locationNotes" TEXT,
    "recurrenceRule" JSONB,
    "generationWeeks" INTEGER NOT NULL DEFAULT 8,
    "bookingCutoffHours" INTEGER NOT NULL DEFAULT 1,
    "cancellationHours" INTEGER NOT NULL DEFAULT 24,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SessionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionOccurrence" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "startTime" TIMESTAMPTZ(6) NOT NULL,
    "endTime" TIMESTAMPTZ(6) NOT NULL,
    "maxCapacity" INTEGER NOT NULL,
    "bookedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "cancelReason" TEXT,
    "priceOverride" DECIMAL(10,2),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionBooking" (
    "id" UUID NOT NULL,
    "occurrenceId" UUID NOT NULL,
    "clientId" TEXT NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "paidAmount" DECIMAL(10,2),
    "paymentIntentId" TEXT,
    "cancelledAt" TIMESTAMPTZ(6),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SessionBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionTemplate_mongoServiceId_idx" ON "SessionTemplate"("mongoServiceId");

-- CreateIndex
CREATE INDEX "SessionTemplate_freelancerId_idx" ON "SessionTemplate"("freelancerId");

-- CreateIndex
CREATE INDEX "SessionTemplate_isActive_freelancerId_idx" ON "SessionTemplate"("isActive", "freelancerId");

-- CreateIndex
CREATE INDEX "SessionOccurrence_freelancerId_startTime_idx" ON "SessionOccurrence"("freelancerId", "startTime");

-- CreateIndex
CREATE INDEX "SessionOccurrence_status_startTime_idx" ON "SessionOccurrence"("status", "startTime");

-- CreateIndex
CREATE INDEX "SessionOccurrence_templateId_status_idx" ON "SessionOccurrence"("templateId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SessionOccurrence_templateId_startTime_key" ON "SessionOccurrence"("templateId", "startTime");

-- CreateIndex
CREATE INDEX "SessionBooking_clientId_idx" ON "SessionBooking"("clientId");

-- CreateIndex
CREATE INDEX "SessionBooking_occurrenceId_status_idx" ON "SessionBooking"("occurrenceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SessionBooking_occurrenceId_clientId_key" ON "SessionBooking"("occurrenceId", "clientId");

-- AddForeignKey
ALTER TABLE "SessionOccurrence" ADD CONSTRAINT "SessionOccurrence_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SessionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionBooking" ADD CONSTRAINT "SessionBooking_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "SessionOccurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
