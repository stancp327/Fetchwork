-- AlterTable
ALTER TABLE "BookingOccurrence" ADD COLUMN     "reviewPromptSentAt" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "FreelancerAvailability" ADD COLUMN     "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ServiceAvailabilityOverride" ADD COLUMN     "bufferAfterMinutes" INTEGER,
ADD COLUMN     "bufferBeforeMinutes" INTEGER;

-- CreateTable
CREATE TABLE "IntakeFormTemplate" (
    "id" UUID NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "serviceId" TEXT,
    "name" TEXT NOT NULL,
    "fieldsJson" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "IntakeFormTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeFormResponse" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "clientId" TEXT NOT NULL,
    "responsesJson" JSONB NOT NULL,
    "submittedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "IntakeFormResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MultiServiceBooking" (
    "id" UUID NOT NULL,
    "clientId" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "bookingIds" TEXT[],
    "totalDurationMinutes" INTEGER NOT NULL,
    "totalPriceCents" INTEGER NOT NULL,
    "combinedStartAtUtc" TIMESTAMPTZ(6) NOT NULL,
    "combinedEndAtUtc" TIMESTAMPTZ(6) NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "MultiServiceBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePackage" (
    "id" UUID NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "serviceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sessionCount" INTEGER NOT NULL,
    "pricePerSessionCents" INTEGER NOT NULL,
    "totalPriceCents" INTEGER NOT NULL,
    "savingsPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "validityDays" INTEGER NOT NULL DEFAULT 365,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxPerClient" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ServicePackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackagePurchase" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "clientId" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "sessionsTotal" INTEGER NOT NULL,
    "sessionsUsed" INTEGER NOT NULL DEFAULT 0,
    "paidAmountCents" INTEGER NOT NULL,
    "stripePaymentIntentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "purchasedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PackagePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingReview" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "punctualityRating" INTEGER,
    "communicationRating" INTEGER,
    "qualityRating" INTEGER,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "BookingReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntakeFormTemplate_freelancerId_idx" ON "IntakeFormTemplate"("freelancerId");

-- CreateIndex
CREATE INDEX "IntakeFormTemplate_serviceId_idx" ON "IntakeFormTemplate"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeFormTemplate_freelancerId_serviceId_key" ON "IntakeFormTemplate"("freelancerId", "serviceId");

-- CreateIndex
CREATE INDEX "IntakeFormResponse_bookingId_idx" ON "IntakeFormResponse"("bookingId");

-- CreateIndex
CREATE INDEX "IntakeFormResponse_clientId_idx" ON "IntakeFormResponse"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeFormResponse_templateId_bookingId_key" ON "IntakeFormResponse"("templateId", "bookingId");

-- CreateIndex
CREATE INDEX "MultiServiceBooking_clientId_idx" ON "MultiServiceBooking"("clientId");

-- CreateIndex
CREATE INDEX "MultiServiceBooking_freelancerId_idx" ON "MultiServiceBooking"("freelancerId");

-- CreateIndex
CREATE INDEX "ServicePackage_freelancerId_idx" ON "ServicePackage"("freelancerId");

-- CreateIndex
CREATE INDEX "ServicePackage_serviceId_idx" ON "ServicePackage"("serviceId");

-- CreateIndex
CREATE INDEX "PackagePurchase_clientId_idx" ON "PackagePurchase"("clientId");

-- CreateIndex
CREATE INDEX "PackagePurchase_freelancerId_idx" ON "PackagePurchase"("freelancerId");

-- CreateIndex
CREATE INDEX "PackagePurchase_packageId_idx" ON "PackagePurchase"("packageId");

-- CreateIndex
CREATE INDEX "BookingReview_revieweeId_idx" ON "BookingReview"("revieweeId");

-- CreateIndex
CREATE INDEX "BookingReview_bookingId_idx" ON "BookingReview"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingReview_bookingId_reviewerId_key" ON "BookingReview"("bookingId", "reviewerId");

-- AddForeignKey
ALTER TABLE "IntakeFormResponse" ADD CONSTRAINT "IntakeFormResponse_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "IntakeFormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagePurchase" ADD CONSTRAINT "PackagePurchase_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ServicePackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
