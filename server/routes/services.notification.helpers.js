const Notification = require('../models/Notification');

async function notifyServiceEvent({ recipient, title, message, serviceId = null, link = null }) {
  return Notification.create({
    recipient,
    title,
    message,
    ...(link ? { link } : serviceId ? { link: `/services/${serviceId}` } : {}),
  });
}

module.exports = { notifyServiceEvent };
