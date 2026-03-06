/**
 * ReminderService — Schedule and manage booking reminders
 * 
 * Reminder types:
 * - 24h_before: Day-before reminder
 * - 1h_before: Hour-before reminder  
 * - 15m_before: Last-minute reminder
 * - followup: Post-booking follow-up
 * 
 * Channels: email, push, sms
 */

const { getPrisma } = require('../db/client');

const REMINDER_OFFSETS = {
  '24h_before': 24 * 60 * 60 * 1000,
  '1h_before': 1 * 60 * 60 * 1000,
  '15m_before': 15 * 60 * 1000,
  'followup': -1 * 60 * 60 * 1000, // 1 hour after
};

const DEFAULT_REMINDER_TYPES = ['24h_before', '1h_before'];

class ReminderService {
  constructor(deps = {}) {
    this.prisma = deps.prisma || null;
    this.emailSender = deps.emailSender || null;
    this.pushSender = deps.pushSender || null;
    this.smsSender = deps.smsSender || null;
  }

  _getPrisma() {
    if (this.prisma) return this.prisma;
    return getPrisma();
  }

  /**
   * Schedule reminders for a booking occurrence.
   * Called when a booking is confirmed.
   */
  async scheduleReminders({ 
    bookingId, 
    occurrenceId, 
    clientId,
    freelancerId,
    startAtUtc,
    bookingDetails = {},
    reminderTypes = DEFAULT_REMINDER_TYPES,
    channels = ['email', 'push'],
  }) {
    const prisma = this._getPrisma();
    const reminders = [];
    const now = new Date();

    for (const reminderType of reminderTypes) {
      const offset = REMINDER_OFFSETS[reminderType];
      if (offset === undefined) continue;

      const scheduledFor = new Date(new Date(startAtUtc).getTime() - offset);
      
      // Skip if reminder time is in the past
      if (scheduledFor <= now) continue;

      // Create reminder for both client and freelancer
      for (const { recipientId, recipientRole } of [
        { recipientId: clientId, recipientRole: 'client' },
        { recipientId: freelancerId, recipientRole: 'freelancer' },
      ]) {
        for (const channel of channels) {
          reminders.push({
            bookingId,
            occurrenceId,
            recipientId,
            recipientRole,
            channel,
            reminderType,
            scheduledFor,
            status: 'scheduled',
            contentJson: {
              ...bookingDetails,
              recipientRole,
              reminderType,
            },
          });
        }
      }
    }

    if (reminders.length === 0) {
      return { scheduled: 0, reminders: [] };
    }

    const created = await prisma.bookingReminder.createMany({
      data: reminders,
    });

    return { 
      scheduled: created.count, 
      reminders: reminders.map(r => ({ 
        type: r.reminderType, 
        channel: r.channel, 
        scheduledFor: r.scheduledFor,
        recipientRole: r.recipientRole,
      })),
    };
  }

  /**
   * Cancel all reminders for an occurrence.
   * Called when a booking is cancelled or rescheduled.
   */
  async cancelReminders({ occurrenceId }) {
    const prisma = this._getPrisma();

    const result = await prisma.bookingReminder.updateMany({
      where: {
        occurrenceId,
        status: 'scheduled',
      },
      data: {
        status: 'cancelled',
      },
    });

    return { cancelled: result.count };
  }

  /**
   * Get reminders due for processing.
   * Called by the reminder worker/cron job.
   */
  async getDueReminders({ limit = 100 }) {
    const prisma = this._getPrisma();
    const now = new Date();

    return prisma.bookingReminder.findMany({
      where: {
        status: 'scheduled',
        scheduledFor: { lte: now },
      },
      orderBy: { scheduledFor: 'asc' },
      take: limit,
    });
  }

  /**
   * Process a single reminder (send it).
   */
  async processReminder(reminderId) {
    const prisma = this._getPrisma();

    const reminder = await prisma.bookingReminder.findUnique({
      where: { id: reminderId },
    });

    if (!reminder || reminder.status !== 'scheduled') {
      return { success: false, reason: 'Reminder not found or already processed' };
    }

    try {
      // Dispatch to appropriate sender
      switch (reminder.channel) {
        case 'email':
          if (this.emailSender) {
            await this.emailSender.sendBookingReminder(reminder);
          }
          break;
        case 'push':
          if (this.pushSender) {
            await this.pushSender.sendBookingReminder(reminder);
          }
          break;
        case 'sms':
          if (this.smsSender) {
            await this.smsSender.sendBookingReminder(reminder);
          }
          break;
      }

      // Mark as sent
      await prisma.bookingReminder.update({
        where: { id: reminderId },
        data: {
          status: 'sent',
          sentAt: new Date(),
        },
      });

      return { success: true, channel: reminder.channel };
    } catch (error) {
      // Mark as failed
      await prisma.bookingReminder.update({
        where: { id: reminderId },
        data: {
          status: 'failed',
          failReason: error.message,
        },
      });

      return { success: false, reason: error.message };
    }
  }

  /**
   * Process all due reminders (batch).
   * Called by cron job.
   */
  async processDueReminders({ limit = 100 }) {
    const dueReminders = await this.getDueReminders({ limit });
    const results = [];

    for (const reminder of dueReminders) {
      const result = await this.processReminder(reminder.id);
      results.push({
        id: reminder.id,
        type: reminder.reminderType,
        channel: reminder.channel,
        ...result,
      });
    }

    return {
      processed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  }

  /**
   * Reschedule reminders when booking time changes.
   */
  async rescheduleReminders({ occurrenceId, newStartAtUtc }) {
    const prisma = this._getPrisma();
    const now = new Date();

    // Get existing scheduled reminders
    const existing = await prisma.bookingReminder.findMany({
      where: {
        occurrenceId,
        status: 'scheduled',
      },
    });

    let updated = 0;
    let cancelled = 0;

    for (const reminder of existing) {
      const offset = REMINDER_OFFSETS[reminder.reminderType];
      if (offset === undefined) continue;

      const newScheduledFor = new Date(new Date(newStartAtUtc).getTime() - offset);

      if (newScheduledFor <= now) {
        // Cancel if new time is in the past
        await prisma.bookingReminder.update({
          where: { id: reminder.id },
          data: { status: 'cancelled' },
        });
        cancelled++;
      } else {
        // Update to new time
        await prisma.bookingReminder.update({
          where: { id: reminder.id },
          data: { scheduledFor: newScheduledFor },
        });
        updated++;
      }
    }

    return { updated, cancelled };
  }

  /**
   * Get reminder stats for admin dashboard.
   */
  async getStats() {
    const prisma = this._getPrisma();

    const [scheduled, sent, failed, cancelled] = await Promise.all([
      prisma.bookingReminder.count({ where: { status: 'scheduled' } }),
      prisma.bookingReminder.count({ where: { status: 'sent' } }),
      prisma.bookingReminder.count({ where: { status: 'failed' } }),
      prisma.bookingReminder.count({ where: { status: 'cancelled' } }),
    ]);

    return { scheduled, sent, failed, cancelled, total: scheduled + sent + failed + cancelled };
  }

  /**
   * Get reminders for a specific booking.
   */
  async getForBooking(bookingId) {
    const prisma = this._getPrisma();

    return prisma.bookingReminder.findMany({
      where: { bookingId },
      orderBy: { scheduledFor: 'asc' },
    });
  }
}

module.exports = { ReminderService, REMINDER_OFFSETS, DEFAULT_REMINDER_TYPES };
