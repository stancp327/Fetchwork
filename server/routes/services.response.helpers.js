function serializeOrder(order) {
  if (!order) return null;
  const plain = typeof order.toObject === 'function' ? order.toObject() : { ...order };
  return {
    ...plain,
    _id: String(plain._id || order._id),
    client: plain.client ? String(plain.client) : undefined,
  };
}

function serviceRef(service) {
  if (!service) return null;
  return {
    _id: String(service._id),
    title: service.title,
    freelancer: service.freelancer,
  };
}

module.exports = {
  serializeOrder,
  serviceRef,
};
