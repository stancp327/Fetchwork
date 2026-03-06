/**
 * WaitlistNotificationService — Notify users when promoted from waitlist
 * Integrates with ReminderService for delivery.
 */

const { getPrisma } = require('../db/client');

class WaitlistNotificationService {
  constructor(deps = {}) {
    this.prisma = deps.prisma || null;
    this.emailSender = deps.emailSender || null;
    this.pushSender = deps.pushSender || null;
  }

  _getPrisma() {
    if (this.prisma) return this.prisma;
    return getPrisma();
  }

  /**
   * Send notification when user is promoted from waitlist.
   */
  async notifyPromotion({ clientId, slotId, seatCount, promotionExpiresAt, slot }) {
    const notifications = [];

    const content = {
      type: 'waitlist_promotion',
      slotId,
      seatCount,
      promotionExpiresAt,
      serviceName: slot?.serviceName || 'Class',
      date: slot?.date,
      startTime: slot?.startTime,
      message: `A spot opened up! You have until ${promotionExpiresAt.toLocaleString()} to confirm your booking.`,
    };

    // Send email
    if (this.emailSender) {
      try {
        await this.emailSender.sendWaitlistPromotion({ clientId, content });
        notifications.push({ channel: 'email', success: true });
      } catch (e) {
        notifications.push({ channel: 'email', success: false, error: e.message });
      }
    }

    // Send push
    if (this.pushSender) {
      try {
        await this.pushSender.sendWaitlistPromotion({ clientId, content });
        notifications.push({ channel: 'push', success: true });
      } catch (e) {
        notifications.push({ channel: 'push', success: false, error: e.message });
      }
    }

    return { notifications, content };
  }

  /**
   * Send reminder that promotion is expiring soon.
   */
  async notifyPromotionExpiringSoon({ clientId, slotId, hoursRemaining }) {
    const content = {
      type: 'promotion_expiring',
      slotId,
      hoursRemaining,
      message: `Your spot will expire in ${hoursRemaining} hours. Book now to secure your seat!`,
    };

    if (this.pushSender) {
      try {
        await this.pushSender.sendPromotionReminder({ clientId, content });
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    return { success: false, error: 'No push sender configured' };
  }

  /**
   * Notify user their promotion expired.
   */
  async notifyPromotionExpired({ clientId, slotId }) {
    const content = {
      type: 'promotion_expired',
      slotId,
      message: 'Your waitlist spot has expired. You can rejoin the waitlist if spots are still available.',
    };

    if (this.emailSender) {
      try {
        await this.emailSender.sendPromotionExpired({ clientId, content });
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    return { success: false, error: 'No email sender configured' };
  }

  /**
   * Notify user of their waitlist position change.
   */
  async notifyPositionChange({ clientId, slotId, oldPosition, newPosition }) {
    if (newPosition >= oldPosition) return { skipped: true }; // Only notify improvements

    const content = {
      type: 'position_improved',
      slotId,
      oldPosition,
      newPosition,
      message: `You moved up in the waitlist! You're now #${newPosition}.`,
    };

    if (this.pushSender) {
      try {
        await this.pushSender.sendPositionUpdate({ clientId, content });
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    return { skipped: true };
  }

  /**
   * Process pending promotion notifications (cron job).
   * Finds promoted entries that haven't been notified.
   */
  async processPendingPromotions() {
    const prisma = this._getPrisma();

    const promoted = await prisma.waitlistEntry.findMany({
      where: {
        status: 'promoted',
        promotedAt: { not: null },
      },
      include: {
        slot: true,
      },
    });

    const results = [];
    for (const entry of promoted) {
      const result = await this.notifyPromotion({
        clientId: entry.clientId,
        slotId: entry.slotId,
        seatCount: entry.seatCount,
        promotionExpiresAt: entry.promotionExpiresAt,
        slot: entry.slot,
      });
      results.push({ entryId: entry.id, ...result });
    }

    return { processed: results.length, results };
  }
}

module.exports = { WaitlistNotificationService };
