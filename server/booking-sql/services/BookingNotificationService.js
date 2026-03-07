/**
 * BookingNotificationService
 *
 * Creates Mongo Notification records + emits socket events when booking
 * state changes occur in the SQL booking path.
 *
 * Notifications are a Mongo concern (Notification model) — this service
 * bridges the SQL booking events to the existing notification system.
 */

let Notification;
function getNotification() {
  if (!Notification) Notification = require('../../models/Notification');
  return Notification;
}

class BookingNotificationService {
  constructor(deps = {}) {
    this.io = deps.io || null;
  }

  /**
   * Notify after a booking hold is created.
   * Tells the freelancer someone wants to book them.
   */
  async onHoldCreated({ bookingId, bookingRef, clientId, freelancerId, serviceTitle, date, startTime }) {
    await this._create({
      recipientId: freelancerId,
      type:    'booking_confirmed', // reuse existing type (no 'booking_requested' in enum)
      title:   '📅 New booking request',
      message: `New booking for "${serviceTitle}" on ${date} at ${startTime}. Review and confirm.`,
      link:    `/bookings/${bookingId}`,
    });
  }

  /**
   * Notify after a booking is confirmed by the freelancer.
   * Tells the client their booking is confirmed.
   */
  async onConfirmed({ bookingId, bookingRef, clientId, freelancerId, serviceTitle, date, startTime }) {
    await this._create({
      recipientId: clientId,
      type:    'booking_confirmed',
      title:   '✅ Booking confirmed',
      message: `Your booking for "${serviceTitle}" on ${date} at ${startTime} has been confirmed!`,
      link:    `/bookings/${bookingId}`,
    });
  }

  /**
   * Notify after a booking is cancelled.
   * Tells the other party.
   */
  async onCancelled({ bookingId, bookingRef, clientId, freelancerId, cancelledBy, serviceTitle, reason }) {
    const isClientCancel = cancelledBy === 'client';
    const recipientId = isClientCancel ? freelancerId : clientId;
    const cancellerLabel = isClientCancel ? 'The client' : 'The freelancer';

    await this._create({
      recipientId,
      type:    'booking_cancelled',
      title:   '❌ Booking cancelled',
      message: `${cancellerLabel} cancelled the booking for "${serviceTitle}".${reason ? ` Reason: ${reason}` : ''}`,
      link:    `/bookings/${bookingId}`,
    });
  }

  /**
   * Notify after a booking is completed.
   */
  async onCompleted({ bookingId, bookingRef, clientId, serviceTitle }) {
    await this._create({
      recipientId: clientId,
      type:    'booking_confirmed', // reuse — no 'booking_completed' in enum
      title:   '✓ Session completed',
      message: `Your session for "${serviceTitle}" has been marked complete. Please leave a review!`,
      link:    `/bookings/${bookingId}`,
    });
  }

  /**
   * Notify after a booking is rescheduled.
   */
  async onRescheduled({ bookingId, clientId, freelancerId, rescheduledBy, serviceTitle, newDate, newStartTime }) {
    const isClientReschedule = rescheduledBy === 'client';
    const recipientId = isClientReschedule ? freelancerId : clientId;
    const who = isClientReschedule ? 'The client' : 'The freelancer';

    await this._create({
      recipientId,
      type:    'booking_confirmed',
      title:   '🗓 Booking rescheduled',
      message: `${who} rescheduled "${serviceTitle}" to ${newDate} at ${newStartTime}.`,
      link:    `/bookings/${bookingId}`,
    });
  }

  /**
   * Internal: create a notification record + emit socket event.
   */
  async _create({ recipientId, type, title, message, link }) {
    try {
      const Model = getNotification();
      const doc = await Model.create({
        recipient: recipientId,
        type,
        title,
        message,
        link,
      });

      // Emit socket event if io is available
      if (this.io) {
        this.io.to(`user:${recipientId}`).emit('notification', {
          _id:     doc._id,
          type:    doc.type,
          title:   doc.title,
          message: doc.message,
          link:    doc.link,
          read:    false,
          createdAt: doc.createdAt,
        });
      }
    } catch (err) {
      // Non-fatal: don't break the booking flow for notification failures
      console.error('[BookingNotification] Failed to create:', err.message);
    }
  }
}

module.exports = { BookingNotificationService };
