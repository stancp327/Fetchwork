const { getPrisma } = require('./client');

async function bookingSqlHealthcheck() {
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || 'unknown db error' };
  }
}

module.exports = { bookingSqlHealthcheck };
