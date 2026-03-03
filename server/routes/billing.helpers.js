const BillingCredit = require('../models/BillingCredit');

function parsePositiveAmount(amount) {
  const parsed = parseFloat(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

async function createWalletCredit({ userId, teamId = null, amount, reason }) {
  return BillingCredit.create({
    user: userId,
    ...(teamId ? { team: teamId } : {}),
    amount,
    remaining: amount,
    reason,
    status: 'active',
  });
}

module.exports = {
  parsePositiveAmount,
  createWalletCredit,
};
