const Payment = require('../models/Payment');

async function markPaymentCompletedByIntent(stripePaymentIntentId) {
  if (!stripePaymentIntentId) return null;
  return Payment.findOneAndUpdate(
    { stripePaymentIntentId },
    { status: 'completed' }
  );
}

async function markPaymentRefundedByIntent(stripePaymentIntentId) {
  if (!stripePaymentIntentId) return null;
  return Payment.findOneAndUpdate(
    { stripePaymentIntentId },
    { status: 'refunded' }
  );
}

module.exports = {
  markPaymentCompletedByIntent,
  markPaymentRefundedByIntent,
};
