-- AlterTable: add seriesId + skipped to BookingOccurrence
ALTER TABLE "BookingOccurrence" ADD COLUMN "seriesId" UUID;
ALTER TABLE "BookingOccurrence" ADD COLUMN "skipped" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: RecurringSeries
CREATE TABLE "recurring_series" (
    "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
    "bookingId"        UUID NOT NULL,
    "frequency"        TEXT NOT NULL,
    "intervalDays"     INTEGER NOT NULL,
    "startDate"        TEXT NOT NULL,
    "endDate"          TEXT,
    "maxOccurrences"   INTEGER,
    "startTime"        TEXT NOT NULL,
    "endTime"          TEXT NOT NULL,
    "timezone"         TEXT NOT NULL,
    "status"           TEXT NOT NULL DEFAULT 'active',
    "cancelledAt"      TIMESTAMPTZ(6),
    "cancelledFromDate" TEXT,
    "generatedThrough" TEXT,
    "generatedCount"   INTEGER NOT NULL DEFAULT 0,
    "createdAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recurring_series_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: BookingOccurrence.seriesId → recurring_series.id
ALTER TABLE "BookingOccurrence"
    ADD CONSTRAINT "BookingOccurrence_seriesId_fkey"
    FOREIGN KEY ("seriesId")
    REFERENCES "recurring_series"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: recurring_series.bookingId → Booking.id
ALTER TABLE "recurring_series"
    ADD CONSTRAINT "recurring_series_bookingId_fkey"
    FOREIGN KEY ("bookingId")
    REFERENCES "Booking"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "recurring_series_bookingId_key" ON "recurring_series"("bookingId");
CREATE INDEX "recurring_series_status_startDate_idx" ON "recurring_series"("status", "startDate");
CREATE INDEX "BookingOccurrence_seriesId_startAtUtc_idx" ON "BookingOccurrence"("seriesId", "startAtUtc");
