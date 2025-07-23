const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class StripeService {
  async createConnectedAccount(user) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      }
    });
    return account;
  }

  async createAccountLink(accountId, refreshUrl, returnUrl) {
    return await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding'
    });
  }

  async createEscrowPayment(amount, clientId, freelancerId, jobId) {
    return await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      payment_method_types: ['card'],
      capture_method: 'manual', // Hold funds in escrow
      metadata: {
        clientId,
        freelancerId,
        jobId,
        type: 'escrow'
      }
    });
  }

  async releaseEscrowPayment(paymentIntentId, freelancerAccountId) {
    await stripe.paymentIntents.capture(paymentIntentId);
    
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const platformFee = Math.round(paymentIntent.amount * 0.05); // 5% platform fee
    
    return await stripe.transfers.create({
      amount: paymentIntent.amount - platformFee,
      currency: 'usd',
      destination: freelancerAccountId
    });
  }

  async refundEscrowPayment(paymentIntentId, amount = null) {
    const refundData = {
      payment_intent: paymentIntentId
    };
    
    if (amount) {
      refundData.amount = Math.round(amount * 100);
    }
    
    return await stripe.refunds.create(refundData);
  }

  async getAccountStatus(accountId) {
    return await stripe.accounts.retrieve(accountId);
  }

  constructEvent(payload, signature, secret) {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  }
}

module.exports = new StripeService();
