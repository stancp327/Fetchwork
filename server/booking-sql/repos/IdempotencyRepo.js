const { getPrisma } = require('../db/client');

class IdempotencyRepo {
  async findByKey({ idempotencyKey, route, actorId }, tx = null) {
    const db = tx || getPrisma();
    return db.idempotencyKey.findUnique({
      where: {
        idempotencyKey_route_actorId: {
          idempotencyKey,
          route,
          actorId,
        },
      },
    });
  }

  async saveResponse({ idempotencyKey, route, actorId, requestHash, responseJson, statusCode }, tx = null) {
    const db = tx || getPrisma();
    return db.idempotencyKey.upsert({
      where: {
        idempotencyKey_route_actorId: {
          idempotencyKey,
          route,
          actorId,
        },
      },
      update: {
        requestHash,
        responseJson,
        statusCode,
      },
      create: {
        idempotencyKey,
        route,
        actorId,
        requestHash,
        responseJson,
        statusCode,
      },
    });
  }
}

module.exports = { IdempotencyRepo };
