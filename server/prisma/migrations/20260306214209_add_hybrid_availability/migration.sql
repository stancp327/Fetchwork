-- CreateTable
CREATE TABLE "FreelancerAvailability" (
    "id" UUID NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "defaultSlotDuration" INTEGER NOT NULL DEFAULT 60,
    "bufferTime" INTEGER NOT NULL DEFAULT 0,
    "defaultCapacity" INTEGER NOT NULL DEFAULT 1,
    "minNoticeHours" INTEGER NOT NULL DEFAULT 24,
    "maxAdvanceBookingDays" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "weeklyScheduleJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "FreelancerAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAvailabilityOverride" (
    "id" UUID NOT NULL,
    "freelancerAvailId" UUID NOT NULL,
    "serviceId" TEXT NOT NULL,
    "timezone" TEXT,
    "slotDuration" INTEGER,
    "bufferTime" INTEGER,
    "capacity" INTEGER,
    "minNoticeHours" INTEGER,
    "maxAdvanceBookingDays" INTEGER,
    "weeklyScheduleJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ServiceAvailabilityOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityException" (
    "id" UUID NOT NULL,
    "freelancerAvailId" UUID NOT NULL,
    "serviceId" TEXT,
    "date" TEXT NOT NULL,
    "unavailable" BOOLEAN NOT NULL DEFAULT true,
    "windowsJson" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AvailabilityException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FreelancerAvailability_freelancerId_key" ON "FreelancerAvailability"("freelancerId");

-- CreateIndex
CREATE INDEX "FreelancerAvailability_freelancerId_idx" ON "FreelancerAvailability"("freelancerId");

-- CreateIndex
CREATE INDEX "ServiceAvailabilityOverride_serviceId_idx" ON "ServiceAvailabilityOverride"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAvailabilityOverride_freelancerAvailId_serviceId_key" ON "ServiceAvailabilityOverride"("freelancerAvailId", "serviceId");

-- CreateIndex
CREATE INDEX "AvailabilityException_freelancerAvailId_date_idx" ON "AvailabilityException"("freelancerAvailId", "date");

-- CreateIndex
CREATE INDEX "AvailabilityException_serviceId_date_idx" ON "AvailabilityException"("serviceId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityException_freelancerAvailId_serviceId_date_key" ON "AvailabilityException"("freelancerAvailId", "serviceId", "date");

-- AddForeignKey
ALTER TABLE "ServiceAvailabilityOverride" ADD CONSTRAINT "ServiceAvailabilityOverride_freelancerAvailId_fkey" FOREIGN KEY ("freelancerAvailId") REFERENCES "FreelancerAvailability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityException" ADD CONSTRAINT "AvailabilityException_freelancerAvailId_fkey" FOREIGN KEY ("freelancerAvailId") REFERENCES "FreelancerAvailability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
