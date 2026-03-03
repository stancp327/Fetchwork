function markOrderDelivered(order, deliveryNote = '') {
  order.status = 'delivered';
  order.deliveryDate = new Date();
  if (deliveryNote) order.deliveryNote = deliveryNote;
}

function markOrderCompleted(order) {
  order.status = 'completed';
  order.completedDate = new Date();
  order.escrowAmount = 0;
}

function markOrderRevisionRequested(order) {
  order.status = 'revision_requested';
  order.revisionCount = (order.revisionCount || 0) + 1;
}

function markOrderCancelled(order) {
  order.status = 'cancelled';
  order.escrowAmount = 0;
}

module.exports = {
  markOrderDelivered,
  markOrderCompleted,
  markOrderRevisionRequested,
  markOrderCancelled,
};
