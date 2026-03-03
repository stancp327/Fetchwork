function buildServiceOrderMetadata({ serviceId, clientId, freelancerId }) {
  return {
    type: 'service_order',
    serviceId: String(serviceId),
    clientId: String(clientId),
    freelancerId: String(freelancerId),
  };
}

function buildBundlePurchaseMetadata({ serviceId, clientId, freelancerId, bundleId, sessionsTotal }) {
  return {
    type: 'bundle_purchase',
    serviceId: String(serviceId),
    clientId: String(clientId),
    freelancerId: String(freelancerId),
    bundleId: String(bundleId),
    sessionsTotal: String(sessionsTotal),
  };
}

function buildSubscriptionMetadata({ serviceId, clientId, freelancerId, tier, billingCycle, platformFeeRate }) {
  return {
    serviceId: String(serviceId),
    clientId: String(clientId),
    freelancerId: String(freelancerId),
    tier,
    billingCycle,
    platformFeeRate: String(platformFeeRate),
  };
}

module.exports = {
  buildServiceOrderMetadata,
  buildBundlePurchaseMetadata,
  buildSubscriptionMetadata,
};
