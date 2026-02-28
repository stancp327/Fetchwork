const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.warn('⚠️ Stripe not configured - missing STRIPE_SECRET_KEY. Payment features will be disabled.');
}

const stripe = STRIPE_SECRET_KEY ? require('stripe')(STRIPE_SECRET_KEY) : null;

class StripeService {
  _ensureStripe() {
    if (!stripe) {
      throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.');
    }
  }

  // ── Connect Onboarding ──────────────────────────────────────────
  async createConnectAccount(email, country = 'US') {
    this._ensureStripe();
    const account = await stripe.accounts.create({
      type: 'express',
      country,
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers:     { requested: true },
      },
    });
    return account;
  }

  async createAccountLink(accountId, refreshUrl, returnUrl) {
    this._ensureStripe();
    return stripe.accountLinks.create({
      account:     accountId,
      refresh_url: refreshUrl,
      return_url:  returnUrl,
      type:        'account_onboarding',
    });
  }

  async getAccountStatus(accountId) {
    this._ensureStripe();
    const account = await stripe.accounts.retrieve(accountId);
    return {
      id:               account.id,
      charges_enabled:  account.charges_enabled,
      payouts_enabled:  account.payouts_enabled,
      details_submitted: account.details_submitted,
      requirements:     account.requirements,
    };
  }

  // ── Core Payment Flow ───────────────────────────────────────────
  //
  // Architecture: Separate charges + transfers (immediate capture)
  //
  // Why not manual capture?
  //   Card authorization holds expire in 7 days. Jobs can run weeks or
  //   months. Silent expiry = client never charged = freelancer not paid.
  //
  // How the "hold" works:
  //   1. Client's card is charged immediately (chargeForJob)
  //   2. Funds sit in Fetchwork's Stripe balance
  //   3. On client approval, Transfer sends (amount - fee) to freelancer
  //   4. Platform keeps the fee automatically
  //
  // Refund path: if client disputes before release, refundPayment()
  // returns funds to client's card from the platform balance.

  /**
   * Charge client for a job. Funds sit in platform balance until release.
   * Returns a PaymentIntent clientSecret for frontend confirmation.
   *
   * @param {number} amount       - Job amount in dollars
   * @param {string} currency     - Default 'usd'
   * @param {object} metadata     - jobId, clientId, freelancerId etc.
   */
  async chargeForJob(amount, currency = 'usd', metadata = {}) {
    this._ensureStripe();
    return stripe.paymentIntents.create({
      amount:   Math.round(amount * 100), // cents
      currency,
      metadata,
      // No capture_method: 'manual' — charge immediately on confirmation.
      // Funds land in platform balance, transferred to freelancer on release.
    });
  }

  /**
   * Release payment to freelancer after client approves work.
   * Transfers (amount - platformFee) to the freelancer's Connect account.
   *
   * @param {number} amount           - Net payout in dollars
   * @param {string} destinationAccountId - Freelancer's stripeAccountId
   * @param {string} transferGroup    - payment intent ID (links charge to transfer)
   */
  async releasePayment(amount, destinationAccountId, transferGroup) {
    this._ensureStripe();
    return stripe.transfers.create({
      amount:        Math.round(amount * 100), // cents
      currency:      'usd',
      destination:   destinationAccountId,
      transfer_group: transferGroup,
    });
  }

  // ── Refunds ─────────────────────────────────────────────────────
  async refundPayment(paymentIntentId, amount, reason = 'requested_by_customer') {
    this._ensureStripe();
    return stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined,
      reason,
    });
  }

  // ── Webhooks ─────────────────────────────────────────────────────
  constructWebhookEvent(payload, signature, endpointSecret) {
    this._ensureStripe();
    return stripe.webhooks.constructEvent(payload, signature, endpointSecret);
  }

  // ── Balance & Reporting ──────────────────────────────────────────
  async getBalance(stripeAccountId = null) {
    this._ensureStripe();
    const opts = stripeAccountId ? { stripeAccount: stripeAccountId } : {};
    return stripe.balance.retrieve(opts);
  }

  async listTransactions(limit = 10, startingAfter = null) {
    this._ensureStripe();
    return stripe.balanceTransactions.list({
      limit,
      ...(startingAfter && { starting_after: startingAfter }),
    });
  }

  // ── Legacy aliases (kept for any indirect callers) ───────────────
  /** @deprecated Use chargeForJob() instead */
  async holdFundsInEscrow(amount, currency = 'usd', metadata = {}) {
    return this.chargeForJob(amount, currency, metadata);
  }

  /** @deprecated releasePayment() handles release now — no capture needed */
  async releaseFundsFromEscrow() {
    throw new Error('releaseFundsFromEscrow is deprecated. Use releasePayment() instead.');
  }

  /** @deprecated Use releasePayment() instead */
  async createTransfer(amount, destination) {
    return this.releasePayment(amount, destination);
  }
}

module.exports = new StripeService();
