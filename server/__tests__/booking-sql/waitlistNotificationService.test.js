/**
 * WaitlistNotificationService Tests
 */

const { WaitlistNotificationService } = require('../../booking-sql/services/WaitlistNotificationService');

describe('WaitlistNotificationService', () => {
  describe('notifyPromotion', () => {
    test('sends email and push notifications', async () => {
      const emailSender = { sendWaitlistPromotion: jest.fn().mockResolvedValue(true) };
      const pushSender = { sendWaitlistPromotion: jest.fn().mockResolvedValue(true) };

      const service = new WaitlistNotificationService({ emailSender, pushSender });

      const result = await service.notifyPromotion({
        clientId: 'client-1',
        slotId: 'slot-1',
        seatCount: 2,
        promotionExpiresAt: new Date(),
        slot: { serviceName: 'Yoga Class', date: '2026-04-01', startTime: '10:00' },
      });

      expect(result.notifications).toHaveLength(2);
      expect(result.notifications[0].success).toBe(true);
      expect(result.content.type).toBe('waitlist_promotion');
    });

    test('handles sender failures gracefully', async () => {
      const emailSender = { sendWaitlistPromotion: jest.fn().mockRejectedValue(new Error('fail')) };

      const service = new WaitlistNotificationService({ emailSender });

      const result = await service.notifyPromotion({
        clientId: 'client-1',
        slotId: 'slot-1',
        seatCount: 1,
        promotionExpiresAt: new Date(),
      });

      expect(result.notifications[0].success).toBe(false);
      expect(result.notifications[0].error).toBe('fail');
    });
  });

  describe('notifyPositionChange', () => {
    test('notifies on position improvement', async () => {
      const pushSender = { sendPositionUpdate: jest.fn().mockResolvedValue(true) };

      const service = new WaitlistNotificationService({ pushSender });

      const result = await service.notifyPositionChange({
        clientId: 'client-1',
        slotId: 'slot-1',
        oldPosition: 5,
        newPosition: 2,
      });

      expect(result.success).toBe(true);
      expect(pushSender.sendPositionUpdate).toHaveBeenCalled();
    });

    test('skips notification if position worsened', async () => {
      const pushSender = { sendPositionUpdate: jest.fn() };

      const service = new WaitlistNotificationService({ pushSender });

      const result = await service.notifyPositionChange({
        clientId: 'client-1',
        slotId: 'slot-1',
        oldPosition: 2,
        newPosition: 5,
      });

      expect(result.skipped).toBe(true);
      expect(pushSender.sendPositionUpdate).not.toHaveBeenCalled();
    });
  });

  describe('notifyPromotionExpired', () => {
    test('sends email notification', async () => {
      const emailSender = { sendPromotionExpired: jest.fn().mockResolvedValue(true) };

      const service = new WaitlistNotificationService({ emailSender });

      const result = await service.notifyPromotionExpired({
        clientId: 'client-1',
        slotId: 'slot-1',
      });

      expect(result.success).toBe(true);
    });
  });
});
