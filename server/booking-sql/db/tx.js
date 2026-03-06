const { getPrisma } = require('./client');

async function withTx(fn) {
  return getPrisma().$transaction((tx) => fn(tx));
}

module.exports = { withTx };
