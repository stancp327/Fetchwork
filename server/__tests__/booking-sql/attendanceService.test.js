/**
 * AttendanceService Tests
 */

const { AttendanceService } = require('../../booking-sql/services/AttendanceService');

describe('AttendanceService', () => {
  function createMockPrisma(overrides = {}) {
    return {
      attendanceRecord: {
        upsert: jest.fn().mockResolvedValue({ status: 'client_arrived', clientCheckinAt: new Date() }),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ status: 'completed' }),
        ...overrides.attendanceRecord,
      },
      bookingOccurrence: {
        update: jest.fn().mockResolvedValue({}),
        ...overrides.bookingOccurrence,
      },
    };
  }

  describe('clientCheckin', () => {
    test('creates attendance record', async () => {
      const prisma = createMockPrisma();
      const service = new AttendanceService({ prisma });

      const result = await service.clientCheckin({ occurrenceId: 'occ-1', meta: { lat: 37.7 } });

      expect(result.success).toBe(true);
      expect(prisma.attendanceRecord.upsert).toHaveBeenCalled();
    });
  });

  describe('freelancerCheckin', () => {
    test('sets in_progress when client already checked in', async () => {
      const prisma = createMockPrisma({
        attendanceRecord: {
          findUnique: jest.fn().mockResolvedValue({ clientCheckinAt: new Date() }),
          upsert: jest.fn().mockResolvedValue({ status: 'in_progress' }),
        },
      });
      const service = new AttendanceService({ prisma });

      const result = await service.freelancerCheckin({ occurrenceId: 'occ-1' });

      expect(result.status).toBe('in_progress');
    });
  });

  describe('markNoShow', () => {
    test('marks client no-show and flags dispute', async () => {
      const prisma = createMockPrisma();
      const service = new AttendanceService({ prisma });

      const result = await service.markNoShow({ occurrenceId: 'occ-1', noShowParty: 'client' });

      expect(result.status).toBe('no_show_client');
      expect(prisma.bookingOccurrence.update).toHaveBeenCalled();
    });
  });

  describe('adminResolve', () => {
    test('resolves dispute with adjustment', async () => {
      const prisma = createMockPrisma({
        attendanceRecord: {
          update: jest.fn().mockResolvedValue({ status: 'resolved', disputeFlag: false }),
        },
      });
      const service = new AttendanceService({ prisma });

      const result = await service.adminResolve({
        occurrenceId: 'occ-1',
        resolution: { status: 'completed', refundPercent: 50 },
        adminId: 'admin-1',
      });

      expect(result.success).toBe(true);
    });
  });
});
