async function loadActiveService({ Service, serviceId, populate = null }) {
  const q = Service.findById(serviceId);
  if (populate) q.populate(populate);
  const service = await q;

  if (!service || !service.isActive || service.status !== 'active') {
    return { error: { status: 404, message: 'Service not found or unavailable' } };
  }

  return { service };
}

function ensureNotSelfService(serviceFreelancerId, requesterId) {
  if (String(serviceFreelancerId) === String(requesterId)) {
    return { ok: false, error: 'Cannot order your own service' };
  }
  return { ok: true };
}

module.exports = {
  loadActiveService,
  ensureNotSelfService,
};
