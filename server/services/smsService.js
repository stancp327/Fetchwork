/**
 * smsService.js — Twilio SMS wrapper for Fetchwork
 * All sends are opt-in gated. Never throws — logs + returns false on failure.
 */
const twilio = require('twilio');

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN;
const FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || '+18556846127';

let client = null;
const getClient = () => {
  if (!client && ACCOUNT_SID && AUTH_TOKEN) {
    client = twilio(ACCOUNT_SID, AUTH_TOKEN);
  }
  return client;
};

/**
 * Send an SMS. Returns true on success, false on failure/disabled.
 * @param {string} to   — E.164 phone number e.g. +14155551234
 * @param {string} body — message text (max 160 chars recommended)
 */
const sendSMS = async (to, body) => {
  const c = getClient();
  if (!c) {
    if (ACCOUNT_SID) console.error('[SMS] Twilio client failed to init');
    return false;
  }
  if (!to || !to.startsWith('+')) {
    console.warn('[SMS] Invalid phone number:', to);
    return false;
  }
  try {
    await c.messages.create({ to, body, from: FROM_NUMBER });
    return true;
  } catch (err) {
    console.error('[SMS] Send failed:', err.message);
    return false;
  }
};

/**
 * Notify a user if they have SMS enabled for the given category.
 * @param {Object} user     — Mongoose User doc (needs .phone + .preferences)
 * @param {string} category — one of: messages | bookingReminders | payments | proposals | disputes | marketing
 * @param {string} body     — message text
 */
// Per-recipient rate limit: max 1 SMS per category per 5 minutes
const _rateLimitMap = new Map(); // key: `${userId}:${category}` → timestamp
const RATE_LIMIT_MS = 5 * 60 * 1000;

const notifyUser = async (user, category, body) => {
  if (!user?.phone) return false;
  const prefs = user.preferences || {};
  if (!prefs.smsNotifications) return false;
  const optIn = prefs.smsOptIn || {};

  // Marketing requires explicit opt-in (TCPA compliance)
  if (category === 'marketing') {
    if (optIn.marketing !== true) return false;
  } else {
    if (optIn[category] === false) return false; // explicit opt-out for other categories
  }

  // Rate limit: don't send same category SMS to same user within 5 minutes
  const rateKey = `${String(user._id)}:${category}`;
  const lastSent = _rateLimitMap.get(rateKey) || 0;
  if (Date.now() - lastSent < RATE_LIMIT_MS) return false;
  _rateLimitMap.set(rateKey, Date.now());

  // Clean up old entries periodically (prevent memory leak)
  if (_rateLimitMap.size > 10000) {
    const cutoff = Date.now() - RATE_LIMIT_MS;
    for (const [k, v] of _rateLimitMap) {
      if (v < cutoff) _rateLimitMap.delete(k);
    }
  }

  return sendSMS(user.phone, body);
};

// ── Pre-built notification templates ─────────────────────────────

const SMS = {
  // New message in conversation
  newMessage: (senderName) =>
    `Fetchwork: You have a new message from ${senderName}. Reply at fetchwork.net/messages`,

  // Booking reminders
  bookingReminder24h: (serviceName, dateStr) =>
    `Fetchwork reminder: Your booking for "${serviceName}" is tomorrow (${dateStr}). fetchwork.net/bookings`,

  bookingReminder1h: (serviceName, timeStr) =>
    `Fetchwork: Your booking for "${serviceName}" starts in 1 hour at ${timeStr}. fetchwork.net/bookings`,

  bookingCancelled: (serviceName, cancellerName) =>
    `Fetchwork: ${cancellerName} cancelled the booking for "${serviceName}". fetchwork.net/bookings`,

  bookingConfirmed: (serviceName, dateStr) =>
    `Fetchwork: Booking confirmed for "${serviceName}" on ${dateStr}. fetchwork.net/bookings`,

  // Payments
  paymentReceived: (amount) =>
    `Fetchwork: You received a payment of $${amount}. Check your earnings at fetchwork.net/earnings`,

  payoutSent: (amount) =>
    `Fetchwork: Your payout of $${amount} is on its way. fetchwork.net/earnings`,

  // Proposals
  proposalReceived: (jobTitle) =>
    `Fetchwork: New proposal on "${jobTitle}". View it at fetchwork.net/jobs`,

  proposalAccepted: (jobTitle) =>
    `Fetchwork: Your proposal for "${jobTitle}" was accepted! fetchwork.net/messages`,

  // Disputes
  disputeUpdate: (status) =>
    `Fetchwork: Your dispute status changed to: ${status}. fetchwork.net/disputes`,

  // Verification OTP (future)
  verificationCode: (code) =>
    `Your Fetchwork verification code is: ${code}. Expires in 10 minutes. Do not share this code.`,
};

module.exports = { sendSMS, notifyUser, SMS };
