const { Conversation } = require('../models/Message');

async function findServiceConversation({ serviceId, orderId = null, participants = [] }) {
  if (serviceId && orderId) {
    const exact = await Conversation.findOne({ service: serviceId, serviceOrderId: orderId });
    if (exact) return exact;
  }

  if (serviceId) {
    const byService = await Conversation.findOne({ service: serviceId });
    if (byService) return byService;
  }

  if (participants.length === 2) {
    return Conversation.findOne({ participants: { $all: participants } });
  }

  return null;
}

module.exports = { findServiceConversation };
