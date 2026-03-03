async function loadServiceOrderContext({ Service, serviceId, orderId, userId, populate = '' }) {
  const q = Service.findById(serviceId);
  if (populate) q.populate(populate);
  const service = await q;
  if (!service) return { error: { status: 404, message: 'Service not found' } };

  const order = service.orders.id(orderId);
  if (!order) return { error: { status: 404, message: 'Order not found' } };

  const freelancerId = String(service.freelancer?._id || service.freelancer);
  const clientId = String(order.client);
  const requesterId = String(userId);

  return {
    service,
    order,
    isClient: clientId === requesterId,
    isFreelancer: freelancerId === requesterId,
    clientId,
    freelancerId,
  };
}

module.exports = { loadServiceOrderContext };
