const Notification = require('../models/Notification');

/**
 * Create a notification, swallowing errors so a failed notification
 * never crashes a route handler.
 *
 * Accepts all fields the Notification model supports
 * (recipient, type, title, message, link, relatedJob, relatedDispute, etc.).
 */
async function notify({ recipient, type, title, message, link, ...rest }) {
  try {
    return await Notification.create({ recipient, type, title, message, link, ...rest });
  } catch (err) {
    console.error('[notificationService] Failed to create notification:', err.message);
  }
}

module.exports = { notify };
