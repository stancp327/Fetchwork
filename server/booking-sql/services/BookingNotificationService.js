/**
 * BookingNotificationService
 *
 * Creates Mongo Notification records + emits socket events + sends emails
 * when booking state changes occur in the SQL booking path.
 */

let Notification;
function getNotification() {
  if (!Notification) Notification = require('../../models/Notification');
  return Notification;
}

let User;
function getUser() {
  if (!User) User = require('../../models/User');
  return User;
}

const emailService = require('../../services/emailService');
const CLIENT_URL   = () => process.env.CLIENT_URL || 'https://fetchwork.net';

// ── Email helpers ─────────────────────────────────────────────────────────────

async function lookupEmails(...userIds) {
  try {
    const Model = getUser();
    const users = await Model.find({ _id: { $in: userIds } }).select('_id email firstName').lean();
    const map = {};
    users.forEach(u => { map[String(u._id)] = { email: u.email, firstName: u.firstName || 'there' }; });
    return map;
  } catch {
    return {};
  }
}

function bookingLink(bookingId) {
  return `${CLIENT_URL()}/bookings/${bookingId}`;
}

async function sendBookingEmail({ to, firstName, subject, headline, body, ctaLabel, ctaUrl, color = '#2563eb' }) {
  if (!to) return;
  const content = `
    <p>Hi ${firstName},</p>
    <p>${body}</p>
    <p style="text-align:center;margin:32px 0">
      <a href="${ctaUrl}" style="background:${color};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">${ctaLabel}</a>
    </p>
    <p style="color:#6b7280;font-size:13px">You can manage all your bookings in your Fetchwork dashboard.</p>
  `;
  await emailService.sendEmail(to, subject, content, headline, color).catch(() => {});
}

// ── Class ─────────────────────────────────────────────────────────────────────

class BookingNotificationService {
  constructor(deps = {}) {
    this.io = deps.io || null;
  }

  /** Freelancer: someone wants to book you */
  async onHoldCreated({ bookingId, bookingRef, clientId, freelancerId, serviceTitle, date, startTime }) {
    await this._create({
      recipientId: freelancerId,
      type:    'booking_confirmed',
      title:   '📅 New booking request',
      message: `New booking for "${serviceTitle}" on ${date} at ${startTime}. Review and confirm.`,
      link:    `/bookings/${bookingId}`,
    });

    const users = await lookupEmails(freelancerId);
    const fl = users[String(freelancerId)];
    if (fl) {
      await sendBookingEmail({
        to:        fl.email,
        firstName: fl.firstName,
        subject:   `📅 New booking request for "${serviceTitle}"`,
        headline:  'New Booking Request',
        body:      `A client has requested a booking for <strong>${serviceTitle}</strong> on <strong>${date} at ${startTime}</strong>. Head to your dashboard to review and confirm.`,
        ctaLabel:  'Review Booking',
        ctaUrl:    bookingLink(bookingId),
        color:     '#2563eb',
      });
    }
  }

  /** Client: your booking is confirmed */
  async onConfirmed({ bookingId, bookingRef, clientId, freelancerId, serviceTitle, date, startTime }) {
    await this._create({
      recipientId: clientId,
      type:    'booking_confirmed',
      title:   '✅ Booking confirmed',
      message: `Your booking for "${serviceTitle}" on ${date} at ${startTime} has been confirmed!`,
      link:    `/bookings/${bookingId}`,
    });

    const users = await lookupEmails(clientId);
    const cl = users[String(clientId)];
    if (cl) {
      await sendBookingEmail({
        to:        cl.email,
        firstName: cl.firstName,
        subject:   `✅ Booking confirmed — ${serviceTitle}`,
        headline:  'Your Booking is Confirmed!',
        body:      `Great news! Your booking for <strong>${serviceTitle}</strong> on <strong>${date} at ${startTime}</strong> has been confirmed. See you then!`,
        ctaLabel:  'View Booking',
        ctaUrl:    bookingLink(bookingId),
        color:     '#059669',
      });
    }
  }

  /** Both parties: booking cancelled */
  async onCancelled({ bookingId, bookingRef, clientId, freelancerId, cancelledBy, serviceTitle, reason }) {
    const isClientCancel  = cancelledBy === 'client';
    const recipientId     = isClientCancel ? freelancerId : clientId;
    const cancellerLabel  = isClientCancel ? 'The client' : 'The freelancer';

    await this._create({
      recipientId,
      type:    'booking_cancelled',
      title:   '❌ Booking cancelled',
      message: `${cancellerLabel} cancelled the booking for "${serviceTitle}".${reason ? ` Reason: ${reason}` : ''}`,
      link:    `/bookings/${bookingId}`,
    });

    // Email both parties
    const users = await lookupEmails(clientId, freelancerId);
    const notifyIds = [clientId, freelancerId].filter(id => String(id) !== String(recipientId));
    // Notify the recipient and optionally the other party too
    const allIds = [clientId, freelancerId];
    for (const uid of allIds) {
      const u = users[String(uid)];
      if (!u) continue;
      const isCanceller = (isClientCancel && String(uid) === String(clientId)) ||
                          (!isClientCancel && String(uid) === String(freelancerId));
      const body = isCanceller
        ? `You cancelled the booking for <strong>${serviceTitle}</strong>.${reason ? ` Reason: ${reason}` : ''}`
        : `${cancellerLabel} cancelled the booking for <strong>${serviceTitle}</strong>.${reason ? ` Reason: ${reason}` : ''}`;

      await sendBookingEmail({
        to:        u.email,
        firstName: u.firstName,
        subject:   `Booking cancelled — ${serviceTitle}`,
        headline:  'Booking Cancelled',
        body,
        ctaLabel:  'View Details',
        ctaUrl:    bookingLink(bookingId),
        color:     '#dc2626',
      });
    }
  }

  /** Client: session completed */
  async onCompleted({ bookingId, bookingRef, clientId, serviceTitle }) {
    await this._create({
      recipientId: clientId,
      type:    'booking_confirmed',
      title:   '🎉 Session completed',
      message: `Your session for "${serviceTitle}" has been marked complete. Please leave a review!`,
      link:    `/bookings/${bookingId}`,
    });

    const users = await lookupEmails(clientId);
    const cl = users[String(clientId)];
    if (cl) {
      await sendBookingEmail({
        to:        cl.email,
        firstName: cl.firstName,
        subject:   `Session completed — ${serviceTitle}`,
        headline:  'Your Session is Complete!',
        body:      `Your session for <strong>${serviceTitle}</strong> has been marked as complete. We'd love to hear how it went — please leave a review!`,
        ctaLabel:  'Leave a Review',
        ctaUrl:    `${CLIENT_URL()}/reviews/new?bookingId=${bookingId}`,
        color:     '#059669',
      });
    }
  }

  /** Both parties: booking rescheduled */
  async onRescheduled({ bookingId, clientId, freelancerId, rescheduledBy, serviceTitle, newDate, newStartTime }) {
    const isClientReschedule = rescheduledBy === 'client';
    const recipientId        = isClientReschedule ? freelancerId : clientId;
    const who                = isClientReschedule ? 'The client' : 'The freelancer';

    await this._create({
      recipientId,
      type:    'booking_confirmed',
      title:   '🔄 Booking rescheduled',
      message: `${who} rescheduled "${serviceTitle}" to ${newDate} at ${newStartTime}.`,
      link:    `/bookings/${bookingId}`,
    });

    const users = await lookupEmails(clientId, freelancerId);
    for (const uid of [clientId, freelancerId]) {
      const u = users[String(uid)];
      if (!u) continue;
      await sendBookingEmail({
        to:        u.email,
        firstName: u.firstName,
        subject:   `Booking rescheduled — ${serviceTitle}`,
        headline:  'Booking Rescheduled',
        body:      `${who} has rescheduled <strong>${serviceTitle}</strong> to <strong>${newDate} at ${newStartTime}</strong>.`,
        ctaLabel:  'View Booking',
        ctaUrl:    bookingLink(bookingId),
        color:     '#d97706',
      });
    }
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  async _create({ recipientId, type, title, message, link }) {
    try {
      const Model = getNotification();
      const doc = await Model.create({ recipient: recipientId, type, title, message, link });

      if (this.io) {
        this.io.to(`user:${recipientId}`).emit('notification', {
          _id: doc._id, type: doc.type, title: doc.title,
          message: doc.message, link: doc.link, read: false, createdAt: doc.createdAt,
        });
      }
    } catch (err) {
      console.error('[BookingNotification] Failed to create:', err.message);
    }
  }
}

module.exports = { BookingNotificationService };
