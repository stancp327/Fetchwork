const { Message } = require('../models/Message');

async function postServiceSystemMessage({
  conversation,
  sender,
  recipient,
  content,
  type,
  serviceId,
  orderId,
  metadata = {},
}) {
  if (!conversation) return null;

  const msg = new Message({
    conversation: conversation._id,
    sender,
    recipient,
    content,
    messageType: 'system',
    metadata: {
      type,
      serviceId,
      orderId,
      ...metadata,
    },
  });

  await msg.save();
  conversation.lastMessage = msg._id;
  await conversation.updateLastActivity();
  return msg;
}

module.exports = { postServiceSystemMessage };
