-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('service', 'job', 'phone', 'video', 'consultation');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('proposed', 'confirmed', 'cancelled', 'completed');

-- CreateTable
CREATE TABLE "Appointment" (
    "id" UUID NOT NULL,
    "conversationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "appointmentType" "AppointmentType" NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'proposed',
    "proposedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMPTZ(6),
    "jobId" TEXT,
    "serviceId" TEXT,
    "startAtUtc" TIMESTAMPTZ(6) NOT NULL,
    "endAtUtc" TIMESTAMPTZ(6) NOT NULL,
    "timezone" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Appointment_conversationId_startAtUtc_idx" ON "Appointment"("conversationId", "startAtUtc");

-- CreateIndex
CREATE INDEX "Appointment_clientId_startAtUtc_idx" ON "Appointment"("clientId", "startAtUtc");

-- CreateIndex
CREATE INDEX "Appointment_freelancerId_startAtUtc_idx" ON "Appointment"("freelancerId", "startAtUtc");

-- CreateIndex
CREATE INDEX "Appointment_status_startAtUtc_idx" ON "Appointment"("status", "startAtUtc");
