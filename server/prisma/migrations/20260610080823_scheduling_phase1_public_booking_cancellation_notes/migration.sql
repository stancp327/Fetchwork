-- CreateEnum
CREATE TYPE "CancellationPolicyType" AS ENUM ('flexible', 'moderate', 'strict', 'custom');

-- CreateTable
CREATE TABLE "CancellationPolicy" (
    "id" UUID NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "serviceId" TEXT,
    "type" "CancellationPolicyType" NOT NULL DEFAULT 'moderate',
    "rulesJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "CancellationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionNote" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "occurrenceId" UUID,
    "authorId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SessionNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CancellationPolicy_freelancerId_idx" ON "CancellationPolicy"("freelancerId");

-- CreateIndex
CREATE UNIQUE INDEX "CancellationPolicy_freelancerId_serviceId_key" ON "CancellationPolicy"("freelancerId", "serviceId");

-- CreateIndex
CREATE INDEX "SessionNote_bookingId_createdAt_idx" ON "SessionNote"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "SessionNote_occurrenceId_createdAt_idx" ON "SessionNote"("occurrenceId", "createdAt");

-- CreateIndex
CREATE INDEX "SessionNote_authorId_idx" ON "SessionNote"("authorId");
