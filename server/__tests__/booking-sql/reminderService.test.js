/**
 * ReminderService Tests
 * Tests reminder scheduling, cancellation, and processing.
 */

const { ReminderService, REMINDER_OFFSETS } = require('../../booking-sql/services/ReminderService');

describe('ReminderService', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // Mock Prisma
  // ═══════════════════════════════════════════════════════════════════════════
  
  function createMockPrisma(overrides = {}) {
    return {
      bookingReminder: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
        ...overrides.bookingReminder,
      },
    };
  }

  // Future date for testing (48h from now)
  const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);

  // ═══════════════════════════════════════════════════════════════════════════
  // scheduleReminders Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('scheduleReminders', () => {
    test('creates reminders for client and freelancer', async () => {
      const prisma = createMockPrisma({
        bookingReminder: {
          createMany: jest.fn().mockResolvedValue({ count: 8 }),
        },
      });

      const service = new ReminderService({ prisma });
      
      const result = await service.scheduleReminders({
        bookingId: 'booking-1',
        occurrenceId: 'occ-1',
        clientId: 'client-1',
        freelancerId: 'freelancer-1',
        startAtUtc: futureDate,
        bookingDetails: { serviceName: 'Dog Walking' },
        reminderTypes: ['24h_before', '1h_before'],
        channels: ['email', 'push'],
      });

      // 2 types × 2 recipients × 2 channels = 8 reminders
      expect(prisma.bookingReminder.createMany).toHaveBeenCalled();
      const createCall = prisma.bookingReminder.createMany.mock.calls[0][0];
      expect(createCall.data).toHaveLength(8);
    });

    test('skips reminders scheduled in the past', async () => {
      const prisma = createMockPrisma({
        bookingReminder: {
          createMany: jest.fn().mockResolvedValue({ count: 4 }),
        },
      });

      const service = new ReminderService({ prisma });
      
      // Booking in 30 minutes - 24h reminder is in the past
      const soon = new Date(Date.now() + 30 * 60 * 1000);
      
      const result = await service.scheduleReminders({
        bookingId: 'booking-1',
        occurrenceId: 'occ-1',
        clientId: 'client-1',
        freelancerId: 'freelancer-1',
        startAtUtc: soon,
        reminderTypes: ['24h_before', '15m_before'],
        channels: ['email', 'push'],
      });

      // Only 15m_before should be scheduled (2 recipients × 2 channels = 4)
      const createCall = prisma.bookingReminder.createMany.mock.calls[0][0];
      expect(createCall.data).toHaveLength(4);
      expect(createCall.data.every(r => r.reminderType === '15m_before')).toBe(true);
    });

    test('returns empty result when all reminders in past', async () => {
      const prisma = createMockPrisma();
      const service = new ReminderService({ prisma });
      
      // Booking in 10 minutes - both reminders in past
      const verySoon = new Date(Date.now() + 10 * 60 * 1000);
      
      const result = await service.scheduleReminders({
        bookingId: 'booking-1',
        occurrenceId: 'occ-1',
        clientId: 'client-1',
        freelancerId: 'freelancer-1',
        startAtUtc: verySoon,
        reminderTypes: ['24h_before', '1h_before'],
        channels: ['email'],
      });

      expect(result.scheduled).toBe(0);
      expect(prisma.bookingReminder.createMany).not.toHaveBeenCalled();
    });

    test('includes booking details in content', async () => {
      const prisma = createMockPrisma({
        bookingReminder: {
          createMany: jest.fn().mockResolvedValue({ count: 4 }),
        },
      });

      const service = new ReminderService({ prisma });
      
      await service.scheduleReminders({
        bookingId: 'booking-1',
        occurrenceId: 'occ-1',
        clientId: 'client-1',
        freelancerId: 'freelancer-1',
        startAtUtc: futureDate,
        bookingDetails: { serviceName: 'Dog Walking', price: '$50' },
        reminderTypes: ['24h_before'],
        channels: ['email'],
      });

      const createCall = prisma.bookingReminder.createMany.mock.calls[0][0];
      expect(createCall.data[0].contentJson.serviceName).toBe('Dog Walking');
      expect(createCall.data[0].contentJson.price).toBe('$50');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // cancelReminders Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('cancelReminders', () => {
    test('cancels all scheduled reminders for occurrence', async () => {
      const prisma = createMockPrisma({
        bookingReminder: {
          updateMany: jest.fn().mockResolvedValue({ count: 4 }),
        },
      });

      const service = new ReminderService({ prisma });
      
      const result = await service.cancelReminders({ occurrenceId: 'occ-1' });

      expect(result.cancelled).toBe(4);
      expect(prisma.bookingReminder.updateMany).toHaveBeenCalledWith({
        where: {
          occurrenceId: 'occ-1',
          status: 'scheduled',
        },
        data: {
          status: 'cancelled',
        },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getDueReminders Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getDueReminders', () => {
    test('returns reminders due for processing', async () => {
      const dueReminders = [
        { id: 'r1', reminderType: '24h_before', status: 'scheduled' },
        { id: 'r2', reminderType: '1h_before', status: 'scheduled' },
      ];

      const prisma = createMockPrisma({
        bookingReminder: {
          findMany: jest.fn().mockResolvedValue(dueReminders),
        },
      });

      const service = new ReminderService({ prisma });
      
      const result = await service.getDueReminders({ limit: 50 });

      expect(result).toHaveLength(2);
      expect(prisma.bookingReminder.findMany).toHaveBeenCalledWith({
        where: {
          status: 'scheduled',
          scheduledFor: { lte: expect.any(Date) },
        },
        orderBy: { scheduledFor: 'asc' },
        take: 50,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // processReminder Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('processReminder', () => {
    test('sends email and marks as sent', async () => {
      const reminder = {
        id: 'r1',
        channel: 'email',
        status: 'scheduled',
        recipientId: 'user-1',
        contentJson: {},
      };

      const prisma = createMockPrisma({
        bookingReminder: {
          findUnique: jest.fn().mockResolvedValue(reminder),
          update: jest.fn().mockResolvedValue({}),
        },
      });

      const emailSender = {
        sendBookingReminder: jest.fn().mockResolvedValue(true),
      };

      const service = new ReminderService({ prisma, emailSender });
      
      const result = await service.processReminder('r1');

      expect(result.success).toBe(true);
      expect(emailSender.sendBookingReminder).toHaveBeenCalledWith(reminder);
      expect(prisma.bookingReminder.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: {
          status: 'sent',
          sentAt: expect.any(Date),
        },
      });
    });

    test('marks as failed on error', async () => {
      const reminder = {
        id: 'r1',
        channel: 'push',
        status: 'scheduled',
      };

      const prisma = createMockPrisma({
        bookingReminder: {
          findUnique: jest.fn().mockResolvedValue(reminder),
          update: jest.fn().mockResolvedValue({}),
        },
      });

      const pushSender = {
        sendBookingReminder: jest.fn().mockRejectedValue(new Error('Push failed')),
      };

      const service = new ReminderService({ prisma, pushSender });
      
      const result = await service.processReminder('r1');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Push failed');
      expect(prisma.bookingReminder.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: {
          status: 'failed',
          failReason: 'Push failed',
        },
      });
    });

    test('skips already processed reminders', async () => {
      const prisma = createMockPrisma({
        bookingReminder: {
          findUnique: jest.fn().mockResolvedValue({ id: 'r1', status: 'sent' }),
        },
      });

      const service = new ReminderService({ prisma });
      
      const result = await service.processReminder('r1');

      expect(result.success).toBe(false);
      expect(result.reason).toMatch(/already processed/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // rescheduleReminders Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('rescheduleReminders', () => {
    test('updates reminder times for new booking time', async () => {
      const existingReminders = [
        { id: 'r1', reminderType: '24h_before', status: 'scheduled' },
        { id: 'r2', reminderType: '1h_before', status: 'scheduled' },
      ];

      const prisma = createMockPrisma({
        bookingReminder: {
          findMany: jest.fn().mockResolvedValue(existingReminders),
          update: jest.fn().mockResolvedValue({}),
        },
      });

      const service = new ReminderService({ prisma });
      
      const result = await service.rescheduleReminders({
        occurrenceId: 'occ-1',
        newStartAtUtc: futureDate,
      });

      expect(result.updated).toBe(2);
      expect(prisma.bookingReminder.update).toHaveBeenCalledTimes(2);
    });

    test('cancels reminders that would be in the past', async () => {
      const existingReminders = [
        { id: 'r1', reminderType: '24h_before', status: 'scheduled' },
      ];

      const prisma = createMockPrisma({
        bookingReminder: {
          findMany: jest.fn().mockResolvedValue(existingReminders),
          update: jest.fn().mockResolvedValue({}),
        },
      });

      const service = new ReminderService({ prisma });
      
      // New time is in 1 hour - 24h reminder would be in the past
      const soon = new Date(Date.now() + 60 * 60 * 1000);
      
      const result = await service.rescheduleReminders({
        occurrenceId: 'occ-1',
        newStartAtUtc: soon,
      });

      expect(result.cancelled).toBe(1);
      expect(prisma.bookingReminder.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: 'cancelled' },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getStats Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getStats', () => {
    test('returns reminder statistics', async () => {
      const prisma = createMockPrisma({
        bookingReminder: {
          count: jest.fn()
            .mockResolvedValueOnce(10) // scheduled
            .mockResolvedValueOnce(100) // sent
            .mockResolvedValueOnce(5) // failed
            .mockResolvedValueOnce(15), // cancelled
        },
      });

      const service = new ReminderService({ prisma });
      
      const stats = await service.getStats();

      expect(stats.scheduled).toBe(10);
      expect(stats.sent).toBe(100);
      expect(stats.failed).toBe(5);
      expect(stats.cancelled).toBe(15);
      expect(stats.total).toBe(130);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REMINDER_OFFSETS Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('REMINDER_OFFSETS', () => {
    test('24h_before is 24 hours in ms', () => {
      expect(REMINDER_OFFSETS['24h_before']).toBe(24 * 60 * 60 * 1000);
    });

    test('1h_before is 1 hour in ms', () => {
      expect(REMINDER_OFFSETS['1h_before']).toBe(60 * 60 * 1000);
    });

    test('15m_before is 15 minutes in ms', () => {
      expect(REMINDER_OFFSETS['15m_before']).toBe(15 * 60 * 1000);
    });

    test('followup is negative (after booking)', () => {
      expect(REMINDER_OFFSETS['followup']).toBeLessThan(0);
    });
  });
});
