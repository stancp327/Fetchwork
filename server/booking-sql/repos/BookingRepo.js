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

  // Count active bookings for a freelancer's service on a given calendar day (local date string YYYY-MM-DD)
  async countBookingsForFreelancerOnDay({ freelancerId, localDate }, tx = null) {
    const db = tx || getPrisma();
    return db.bookingOccurrence.count({
      where: {
        freelancerId: String(freelancerId),
        localStartWallclock: { startsWith: localDate },
        status: { in: ['held', 'confirmed', 'in_progress'] },
      },
    });
  }

  // Count active bookings for a freelancer's service in a 7-day window starting from weekStart (YYYY-MM-DD)
  async countBookingsForFreelancerInWeek({ freelancerId, weekStart }, tx = null) {
    const db = tx || getPrisma();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return db.bookingOccurrence.count({
      where: {
        freelancerId: String(freelancerId),
        startAtUtc: { gte: new Date(weekStart), lt: weekEnd },
        status: { in: ['held', 'confirmed', 'in_progress'] },
      },
    });
  }

  // Count concurrent active bookings for a freelancer across all services
  async countConcurrentActiveBookings({ freelancerId }, tx = null) {
    const db = tx || getPrisma();
    return db.booking.count({
      where: {
        freelancerId: String(freelancerId),
        currentState: { in: ['held', 'confirmed', 'in_progress'] },
      },
    });
  }

  async countConflictsAtLocalStart({ freelancerId, localStartWallclock, excludeBookingId = null }, tx = null) {
    const db = tx || getPrisma();
    return db.bookingOccurrence.count({
      where: {
        freelancerId: String(freelancerId),
        localStartWallclock,
        status: { in: ['held', 'confirmed', 'in_progress'] },
        ...(excludeBookingId ? { bookingId: { not: excludeBookingId } } : {}),
      },
    });
  }

  async updateOccurrenceStatus(id, status, tx = null) {
    const db = tx || getPrisma();
    return db.bookingOccurrence.update({ where: { id }, data: { status } });
  }

  async updateOccurrenceTimes(id, { startAtUtc, endAtUtc, localStartWallclock, localEndWallclock }, tx = null) {
    const db = tx || getPrisma();
    return db.bookingOccurrence.update({
      where: { id },
      data: { startAtUtc, endAtUtc, localStartWallclock, localEndWallclock },
    });
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
