const { getPrisma } = require('../db/client');

class BookingRepo {
  async createBooking(data, tx = null) {
    const db = tx || getPrisma();
    return db.booking.create({ data });
  }

  async createOccurrence(data, tx = null) {
    const db = tx || getPrisma();
    return db.bookingOccurrence.create({ data });
  }

  async findBookingById(id, tx = null) {
    const db = tx || getPrisma();
    return db.booking.findUnique({ where: { id } });
  }

  async findOccurrenceById(id, tx = null) {
    const db = tx || getPrisma();
    return db.bookingOccurrence.findUnique({ where: { id } });
  }

  async findFirstOccurrenceByBookingId(bookingId, tx = null) {
    const db = tx || getPrisma();
    return db.bookingOccurrence.findFirst({
      where: { bookingId },
      orderBy: { occurrenceNo: 'asc' },
    });
  }

  async countConflictsAtLocalStart({ freelancerId, localStartWallclock }, tx = null) {
    const db = tx || getPrisma();
    return db.bookingOccurrence.count({
      where: {
        freelancerId: String(freelancerId),
        localStartWallclock,
        status: { in: ['held', 'confirmed', 'in_progress'] },
      },
    });
  }

  async updateOccurrenceStatus(id, status, tx = null) {
    const db = tx || getPrisma();
    return db.bookingOccurrence.update({ where: { id }, data: { status } });
  }

  async updateBookingState(id, currentState, tx = null) {
    const db = tx || getPrisma();
    return db.booking.update({ where: { id }, data: { currentState } });
  }

  /**
   * Fetch bookings for a user (client or freelancer) with their occurrences.
   * Supports status filters: upcoming | past | cancelled | all
   */
  async findByActor({ actorId, role = 'client', status = 'upcoming' }, tx = null) {
    const db = tx || getPrisma();

    const actorFilter = role === 'freelancer'
      ? { freelancerId: String(actorId) }
      : { clientId: String(actorId) };

    const now = new Date();

    const statusFilter = (() => {
      if (status === 'upcoming') {
        return { currentState: { in: ['held', 'confirmed', 'in_progress'] } };
      }
      if (status === 'past') {
        return { currentState: { in: ['completed', 'no_show_client', 'no_show_freelancer'] } };
      }
      if (status === 'cancelled') {
        return {
          currentState: {
            in: ['cancelled_by_client', 'cancelled_by_freelancer'],
          },
        };
      }
      return {}; // 'all'
    })();

    return db.booking.findMany({
      where: {
        ...actorFilter,
        ...statusFilter,
      },
      include: {
        occurrences: {
          orderBy: { occurrenceNo: 'asc' },
          // for upcoming: only occurrences in the future
          ...(status === 'upcoming'
            ? { where: { startAtUtc: { gte: now } } }
            : {}),
        },
      },
      orderBy: status === 'upcoming'
        ? { createdAt: 'asc' }
        : { createdAt: 'desc' },
    });
  }

  /**
   * Fetch a single booking with all occurrences (for detail view).
   */
  async findByIdWithOccurrences(id, tx = null) {
    const db = tx || getPrisma();
    return db.booking.findUnique({
      where: { id },
      include: { occurrences: { orderBy: { occurrenceNo: 'asc' } } },
    });
  }
}

module.exports = { BookingRepo };
