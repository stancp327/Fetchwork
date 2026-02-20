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

  async createConnectAccount(email, country = 'US') {
    this._ensureStripe();
    try {
      const account = await stripe.accounts.create({
        type: 'express',
        country: country,
        email: email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      
      return account;
    } catch (error) {
      console.error('Error creating Stripe Connect account:', error);
      throw error;
    }
  }

  async createAccountLink(accountId, refreshUrl, returnUrl) {
    this._ensureStripe();
    try {
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });
      
      return accountLink;
    } catch (error) {
      console.error('Error creating account link:', error);
      throw error;
    }
  }

  async getAccountStatus(accountId) {
    this._ensureStripe();
    try {
      const account = await stripe.accounts.retrieve(accountId);
      
      return {
        id: account.id,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        requirements: account.requirements,
      };
    } catch (error) {
      console.error('Error retrieving account status:', error);
      throw error;
    }
  }

  async createPaymentIntent(amount, currency = 'usd', applicationFeeAmount, stripeAccount) {
    this._ensureStripe();
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency,
        application_fee_amount: applicationFeeAmount ? Math.round(applicationFeeAmount * 100) : undefined,
        transfer_data: stripeAccount ? {
          destination: stripeAccount,
        } : undefined,
      });
      
      return paymentIntent;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  }

  async createTransfer(amount, destination, currency = 'usd') {
    this._ensureStripe();
    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency,
        destination: destination,
      });
      
      return transfer;
    } catch (error) {
      console.error('Error creating transfer:', error);
      throw error;
    }
  }

  async holdFundsInEscrow(amount, currency = 'usd', metadata = {}) {
    this._ensureStripe();
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: currency,
        capture_method: 'manual',
        metadata: metadata,
      });
      
      return paymentIntent;
    } catch (error) {
      console.error('Error holding funds in escrow:', error);
      throw error;
    }
  }

  async releaseFundsFromEscrow(paymentIntentId, amountToCapture) {
    this._ensureStripe();
    try {
      const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId, {
        amount_to_capture: amountToCapture ? Math.round(amountToCapture * 100) : undefined,
      });
      
      return paymentIntent;
    } catch (error) {
      console.error('Error releasing funds from escrow:', error);
      throw error;
    }
  }

  async refundPayment(paymentIntentId, amount, reason = 'requested_by_customer') {
    this._ensureStripe();
    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
        reason: reason,
      });
      
      return refund;
    } catch (error) {
      console.error('Error processing refund:', error);
      throw error;
    }
  }

  async constructWebhookEvent(payload, signature, endpointSecret) {
    this._ensureStripe();
    try {
      const event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
      return event;
    } catch (error) {
      console.error('Error constructing webhook event:', error);
      throw error;
    }
  }

  async getBalance(stripeAccountId = null) {
    this._ensureStripe();
    try {
      const balance = await stripe.balance.retrieve(
        stripeAccountId ? { stripeAccount: stripeAccountId } : {}
      );
      
      return balance;
    } catch (error) {
      console.error('Error retrieving balance:', error);
      throw error;
    }
  }

  async listTransactions(limit = 10, startingAfter = null) {
    this._ensureStripe();
    try {
      const transactions = await stripe.balanceTransactions.list({
        limit: limit,
        starting_after: startingAfter,
      });
      
      return transactions;
    } catch (error) {
      console.error('Error listing transactions:', error);
      throw error;
    }
  }
}

module.exports = new StripeService();


