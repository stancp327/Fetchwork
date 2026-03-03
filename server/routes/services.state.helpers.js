function ensureOrderStatus(order, allowedStatuses, message = 'Invalid order status') {
  if (!allowedStatuses.includes(order.status)) {
    return { ok: false, error: message };
  }
  return { ok: true };
}

function ensureRole({ isClient, isFreelancer }, requiredRole) {
  if (requiredRole === 'client' && !isClient) {
    return { ok: false, error: 'Only the client can perform this action' };
  }
  if (requiredRole === 'freelancer' && !isFreelancer) {
    return { ok: false, error: 'Only the freelancer can perform this action' };
  }
  return { ok: true };
}

module.exports = {
  ensureOrderStatus,
  ensureRole,
};
