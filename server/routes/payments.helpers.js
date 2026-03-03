function deriveAuthoritativeEscrowAmount(job) {
  const acceptedProposal = (job?.proposals || []).find((p) => p.status === 'accepted');
  const amount = Number(acceptedProposal?.proposedBudget || job?.budget?.amount || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, amount: 0 };
  }

  return { ok: true, amount };
}

function validateRequestedEscrowAmount(requestedAmount, authoritativeAmount) {
  if (requestedAmount === undefined || requestedAmount === null) {
    return { ok: true };
  }

  const reqAmt = Number(requestedAmount);
  if (!Number.isFinite(reqAmt) || Math.abs(reqAmt - authoritativeAmount) > 0.01) {
    return { ok: false, error: 'Escrow amount mismatch', expectedAmount: authoritativeAmount };
  }

  return { ok: true };
}

module.exports = {
  deriveAuthoritativeEscrowAmount,
  validateRequestedEscrowAmount,
};
