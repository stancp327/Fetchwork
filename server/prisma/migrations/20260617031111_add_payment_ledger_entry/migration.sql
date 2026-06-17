-- CreateTable
CREATE TABLE "PaymentLedgerEntry" (
    "id" UUID NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "grossAmountCents" INTEGER NOT NULL,
    "platformFeeCents" INTEGER NOT NULL DEFAULT 0,
    "payoutAmountCents" INTEGER NOT NULL DEFAULT 0,
    "releasedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "refundedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "stripeTransferId" TEXT,
    "stripeRefundId" TEXT,
    "stripeConnectedAccountId" TEXT,
    "chargedAt" TIMESTAMPTZ(6),
    "heldAt" TIMESTAMPTZ(6),
    "releaseAt" TIMESTAMPTZ(6),
    "releasedAt" TIMESTAMPTZ(6),
    "refundedAt" TIMESTAMPTZ(6),
    "disputedAt" TIMESTAMPTZ(6),
    "cancelledAt" TIMESTAMPTZ(6),
    "failedAt" TIMESTAMPTZ(6),
    "releaseEvent" TEXT,
    "releaseNote" TEXT,
    "failureReason" TEXT,
    "cancelReason" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PaymentLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentLedgerEntry_idempotencyKey_key" ON "PaymentLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentLedgerEntry_clientId_status_idx" ON "PaymentLedgerEntry"("clientId", "status");

-- CreateIndex
CREATE INDEX "PaymentLedgerEntry_freelancerId_status_idx" ON "PaymentLedgerEntry"("freelancerId", "status");

-- CreateIndex
CREATE INDEX "PaymentLedgerEntry_status_releaseAt_idx" ON "PaymentLedgerEntry"("status", "releaseAt");

-- CreateIndex
CREATE INDEX "PaymentLedgerEntry_stripePaymentIntentId_idx" ON "PaymentLedgerEntry"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "PaymentLedgerEntry_stripeTransferId_idx" ON "PaymentLedgerEntry"("stripeTransferId");

-- CreateIndex
CREATE INDEX "PaymentLedgerEntry_stripeConnectedAccountId_idx" ON "PaymentLedgerEntry"("stripeConnectedAccountId");

-- CreateIndex
CREATE INDEX "PaymentLedgerEntry_createdAt_idx" ON "PaymentLedgerEntry"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentLedgerEntry_sourceType_sourceId_key" ON "PaymentLedgerEntry"("sourceType", "sourceId");
