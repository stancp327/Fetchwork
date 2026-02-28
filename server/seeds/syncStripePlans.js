/**
 * One-time script: create Stripe Products + Prices for all paid plans.
 * Safe to run again — skips plans that already have Stripe IDs.
 *
 * Usage: node server/seeds/syncStripePlans.js
 */
require('dotenv').config();
const mongoose     = require('mongoose');
const Plan         = require('../models/Plan');
const stripeService = require('../services/stripeService');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB\n');

  const paidPlans = await Plan.find({ tier: { $ne: 'free' }, active: true });

  for (const plan of paidPlans) {
    let changed = false;
    process.stdout.write(`${plan.name} ... `);

    if (!plan.stripeProductId) {
      const product = await stripeService.createProduct(plan.name, plan.description || '');
      plan.stripeProductId = product.id;
      changed = true;
      process.stdout.write(`product ${product.id} `);
    } else {
      process.stdout.write(`product already exists (${plan.stripeProductId}) `);
    }

    if (!plan.stripePriceId) {
      const price = await stripeService.createPrice(
        plan.stripeProductId,
        Math.round(plan.price * 100),
        plan.interval === 'year' ? 'year' : 'month'
      );
      plan.stripePriceId = price.id;
      changed = true;
      process.stdout.write(`price ${price.id}`);
    } else {
      process.stdout.write(`price already exists (${plan.stripePriceId})`);
    }

    if (changed) await plan.save();
    console.log(' ✅');
  }

  console.log('\nDone.');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
