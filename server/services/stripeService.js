const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.warn('⚠️ Stripe not configured - missing STRIPE_SECRET_KEY. Payment features will be disabled.');
}

const stripe = STRIPE_SECRET_KEY
  ? require('stripe')(STRIPE_SECRET_KEY, { apiVersion: '2026-01-28.clover' })
  : null;

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
      // Stripe chooses the best payment methods per user (cards, Apple Pay,
      // Google Pay, bank transfers, etc.) — no hardcoded payment_method_types.
      automatic_payment_methods: { enabled: true },
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

  // ── Customer & Saved Payment Methods ───────────────────────────
  //
  // Security model:
  //   - One Stripe Customer per Fetchwork user (stripeCustomerId on User model)
  //   - All card data lives in Stripe — we never see or store it
  //   - Every PM operation verifies pm.customer === user.stripeCustomerId
  //     server-side before acting (prevents cross-user attacks)
  //   - Default PM stored on the Customer object via Stripe API (not our DB)

  /** Create a Stripe Customer for a user. Call once; store ID on User. */
  async createCustomer(email, name, metadata = {}) {
    this._ensureStripe();
    return stripe.customers.create({ email, name, metadata });
  }

  /** Fetch or lazily create a Customer. Pass user doc; returns customerId. */
  async ensureCustomer(user) {
    this._ensureStripe();
    if (user.stripeCustomerId) return user.stripeCustomerId;
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    const customer = await stripe.customers.create({
      email: user.email,
      name,
      metadata: { fetchworkUserId: String(user._id) },
    });
    // Caller must save stripeCustomerId to User model
    return customer.id;
  }

  /**
   * Create a SetupIntent to save a card with zero charge.
   * usage: 'off_session' allows future charges without user present.
   */
  async createSetupIntent(customerId) {
    this._ensureStripe();
    return stripe.setupIntents.create({
      customer: customerId,
      usage:    'off_session',
      automatic_payment_methods: { enabled: true },
    });
  }

  /** List saved payment methods for a customer. Returns sanitised card data only. */
  async listPaymentMethods(customerId) {
    this._ensureStripe();
    const [cardPMs, customer] = await Promise.all([
      stripe.paymentMethods.list({ customer: customerId, type: 'card' }),
      stripe.customers.retrieve(customerId),
    ]);
    const defaultPmId = customer.invoice_settings?.default_payment_method;
    return cardPMs.data.map(pm => ({
      id:        pm.id,
      brand:     pm.card.brand,
      last4:     pm.card.last4,
      expMonth:  pm.card.exp_month,
      expYear:   pm.card.exp_year,
      isDefault: pm.id === defaultPmId,
    }));
  }

  /**
   * Verify a payment method belongs to a specific customer.
   * ALWAYS call this before acting on a client-supplied pmId.
   */
  async verifyPMOwnership(pmId, customerId) {
    this._ensureStripe();
    const pm = await stripe.paymentMethods.retrieve(pmId);
    if (!pm || pm.customer !== customerId) {
      throw new Error('Payment method does not belong to this account');
    }
    return pm;
  }

  /** Detach (delete) a payment method. Verifies ownership first. */
  async detachPaymentMethod(pmId, customerId) {
    this._ensureStripe();
    await this.verifyPMOwnership(pmId, customerId); // security check
    return stripe.paymentMethods.detach(pmId);
  }

  /** Set a saved card as the Customer's default. Verifies ownership first. */
  async setDefaultPaymentMethod(pmId, customerId) {
    this._ensureStripe();
    await this.verifyPMOwnership(pmId, customerId); // security check
    return stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: pmId },
    });
  }

  /**
   * Charge a client using a saved payment method.
   * Verifies pm.customer === customerId before creating the PaymentIntent.
   *
   * @param {number} amount
   * @param {string} customerId   - user.stripeCustomerId
   * @param {string} pmId         - saved payment method ID
   * @param {object} metadata
   */
  async chargeWithSavedMethod(amount, customerId, pmId, metadata = {}) {
    this._ensureStripe();
    // Ownership check — prevents a user from charging another user's card
    await this.verifyPMOwnership(pmId, customerId);
    return stripe.paymentIntents.create({
      amount:         Math.round(amount * 100),
      currency:       'usd',
      customer:       customerId,
      payment_method: pmId,
      confirm:        true,
      off_session:    false, // user is present
      metadata,
    });
  }

  // ── PaymentIntent Lookup ─────────────────────────────────────────
  async retrievePaymentIntent(piId) {
    this._ensureStripe();
    return stripe.paymentIntents.retrieve(piId);
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

  // ── Subscription management ──────────────────────────────────────

  /** Create a Stripe Product for a plan. */
  async createProduct(name, description = '') {
    this._ensureStripe();
    return stripe.products.create({ name, description });
  }

  /** Create a Stripe Price for a plan product. amount in cents. */
  async createPrice(productId, unitAmountCents, interval = 'month', currency = 'usd') {
    this._ensureStripe();
    return stripe.prices.create({
      product:      productId,
      unit_amount:  unitAmountCents,
      currency,
      recurring:    { interval },
    });
  }

  /**
   * Create a Stripe Checkout Session for a plan upgrade.
   * @param {string} customerId      Stripe Customer ID
   * @param {string} stripePriceId   Stripe Price ID for the plan
   * @param {string} successUrl      Redirect URL on success (?session_id={CHECKOUT_SESSION_ID})
   * @param {string} cancelUrl       Redirect URL on cancel
   * @param {Object} metadata        Extra metadata (userId, planSlug, etc.)
   */
  async createCheckoutSession(customerId, stripePriceId, successUrl, cancelUrl, metadata = {}) {
    this._ensureStripe();
    return stripe.checkout.sessions.create({
      mode:        'subscription',
      customer:    customerId,
      line_items:  [{ price: stripePriceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url:  cancelUrl,
      metadata,
      subscription_data: { metadata },
      allow_promotion_codes: true,
    });
  }

  /**
   * Create a one-time payment Checkout Session (e.g. wallet top-up).
   * @param {string} customerId   Stripe Customer ID
   * @param {number} amountCents  Amount in cents
   * @param {string} description  Line item description
   * @param {string} successUrl
   * @param {string} cancelUrl
   * @param {object} metadata     Passed to session.metadata
   */
  async createPaymentSession(customerId, amountCents, description, successUrl, cancelUrl, metadata = {}, saveCard = true) {
    this._ensureStripe();
    return stripe.checkout.sessions.create({
      customer:    customerId,
      mode:        'payment',
      line_items:  [{ price_data: {
        currency:    'usd',
        unit_amount: amountCents,
        product_data: { name: description },
      }, quantity: 1 }],
      // Save card for future use (e.g. job payments without re-entering card)
      payment_intent_data: saveCard ? { setup_future_usage: 'off_session' } : undefined,
      success_url: successUrl,
      cancel_url:  cancelUrl,
      metadata,
    });
  }

  /** Create a Stripe Customer Portal session for managing subscription. */
  async createBillingPortalSession(customerId, returnUrl) {
    this._ensureStripe();
    return stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: returnUrl,
    });
  }

  /** Retrieve a subscription from Stripe. */
  async retrieveSubscription(subscriptionId) {
    this._ensureStripe();
    return stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['default_payment_method', 'latest_invoice'],
    });
  }

  /** Cancel a subscription at period end. */
  async cancelSubscriptionAtPeriodEnd(subscriptionId) {
    this._ensureStripe();
    return stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
  }

  /** Cancel a subscription immediately. */
  async cancelSubscriptionImmediately(subscriptionId) {
    this._ensureStripe();
    return stripe.subscriptions.cancel(subscriptionId);
  }

  /** Change a subscription to a new price (upgrade/downgrade). */
  async updateSubscriptionPrice(subscriptionId, newPriceId) {
    this._ensureStripe();
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    return stripe.subscriptions.update(subscriptionId, {
      items: [{ id: sub.items.data[0].id, price: newPriceId }],
      proration_behavior: 'create_prorations',
    });
  }

  /** Verify and construct a billing webhook event. */
  async constructBillingWebhookEvent(rawBody, signature, secret) {
    this._ensureStripe();
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
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

  /** Create an ephemeral key for Stripe React Native Payment Sheet */
  async createEphemeralKey(customerId) {
    this._ensureStripe();
    return stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: '2023-10-16' }
    );
  }
}

module.exports = new StripeService();
