const crypto = require('crypto');
const { getPrisma } = require('../db/client');

class AuditRepo {
  async append({ bookingId, occurrenceId = null, actorType, actorId = null, eventType, payload = {} }, tx = null) {
    const payloadJson = payload;
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payloadJson)).digest('hex');

    const db = tx || getPrisma();
    return db.auditEvent.create({
      data: {
        bookingId,
        occurrenceId,
        actorType,
        actorId,
        eventType,
        payloadJson,
        payloadHash,
      },
    });
  }

  async countByEventType(bookingId, eventType, tx = null) {
    const db = tx || getPrisma();
    return db.auditEvent.count({
      where: { bookingId, eventType },
    });
  }

  async findByBookingId(bookingId, tx = null) {
    const db = tx || getPrisma();
    return db.auditEvent.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'asc' },
    });
  }
}

module.exports = { AuditRepo };
