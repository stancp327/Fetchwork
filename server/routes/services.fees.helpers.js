const { getFee, getFeeIncluded } = require('../services/feeEngine');

async function computeServiceFeeBreakdown({ clientUserId, freelancerUserId, listedPrice, feesIncluded }) {
  if (feesIncluded) {
    const feeResult = await getFeeIncluded({
      userId: String(clientUserId),
      role: 'client',
      jobType: 'remote',
      listedPrice,
    });

    return {
      clientCharges: feeResult.clientCharges,
      totalPlatformFee: feeResult.totalPlatformFee,
      freelancerPayout: feeResult.freelancerPayout,
      clientFeeAmt: feeResult.clientFee,
      freelancerFeeAmt: feeResult.freelancerFee,
      clientFeeRate: null,
      freelancerFeeRate: feeResult.freelancerFee / feeResult.base,
    };
  }

  const clientFeeResult = await getFee({
    userId: String(clientUserId),
    role: 'client',
    jobType: 'remote',
    amount: listedPrice,
  });
  const freelancerFeeResult = await getFee({
    userId: String(freelancerUserId),
    role: 'freelancer',
    jobType: 'remote',
    amount: listedPrice,
  });

  return {
    clientCharges: parseFloat((listedPrice + clientFeeResult.fee).toFixed(2)),
    totalPlatformFee: parseFloat((clientFeeResult.fee + freelancerFeeResult.fee).toFixed(2)),
    freelancerPayout: parseFloat((listedPrice - freelancerFeeResult.fee).toFixed(2)),
    clientFeeAmt: clientFeeResult.fee,
    freelancerFeeAmt: freelancerFeeResult.fee,
    clientFeeRate: clientFeeResult.feeRate,
    freelancerFeeRate: freelancerFeeResult.feeRate,
  };
}

module.exports = { computeServiceFeeBreakdown };
