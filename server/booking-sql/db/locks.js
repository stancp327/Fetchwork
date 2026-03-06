async function acquireSlotLock(tx, { freelancerId, localStartWallclock, serviceId = '' }) {
  const lockKey = `${freelancerId}|${localStartWallclock}|${serviceId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey})::bigint)`;
}

module.exports = { acquireSlotLock };
