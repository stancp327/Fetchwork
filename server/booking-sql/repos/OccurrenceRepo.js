const { getPrisma } = require('../db/client');

class OccurrenceRepo {
  async findActiveForFreelancerDateRange({ freelancerId, dayStartUtc, dayEndUtc }, tx = null) {
    const db = tx || getPrisma();
    return db.bookingOccurrence.findMany({
      where: {
        freelancerId: String(freelancerId),
        startAtUtc: {
          gte: dayStartUtc,
          lte: dayEndUtc,
        },
        status: {
          in: ['held', 'confirmed', 'in_progress'],
        },
      },
      select: {
        id: true,
        localStartWallclock: true,
        status: true,
      },
    });
  }
}

module.exports = { OccurrenceRepo };
