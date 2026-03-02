const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Job = require('../models/Job');
const Service = require('../models/Service');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Boost config — adjust pricing/duration here
const BOOST_OPTIONS = {
  '7day':  { price: 499,  days: 7,  label: '7-day boost ($4.99)' },
  '14day': { price: 899,  days: 14, label: '14-day boost ($8.99)' },
  '30day': { price: 1499, days: 30, label: '30-day boost ($14.99)' },
};

// ── POST /api/boosts/job/:id — Create boost payment for a job
router.post('/job/:id', authenticateToken, async (req, res) => {
  try {
    const { plan = '7day' } = req.body;
    const option = BOOST_OPTIONS[plan];
    if (!option) return res.status(400).json({ error: 'Invalid boost plan' });

    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.client.toString() !== req.user.userId.toString())
      return res.status(403).json({ error: 'Not your job' });
    if (job.status !== 'open')
      return res.status(400).json({ error: 'Only open jobs can be boosted' });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: option.price,
      currency: 'usd',
      metadata: {
        type: 'boost',
        targetType: 'job',
        targetId: job._id.toString(),
        userId: req.user.userId.toString(),
        boostPlan: plan,
        boostDays: option.days.toString(),
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      amount: option.price,
      plan: option.label,
    });
  } catch (err) {
    console.error('Boost payment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/boosts/service/:id — Create boost payment for a service
router.post('/service/:id', authenticateToken, async (req, res) => {
  try {
    const { plan = '7day' } = req.body;
    const option = BOOST_OPTIONS[plan];
    if (!option) return res.status(400).json({ error: 'Invalid boost plan' });

    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ error: 'Service not found' });
    if (service.freelancer.toString() !== req.user.userId.toString())
      return res.status(403).json({ error: 'Not your service' });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: option.price,
      currency: 'usd',
      metadata: {
        type: 'boost',
        targetType: 'service',
        targetId: service._id.toString(),
        userId: req.user.userId.toString(),
        boostPlan: plan,
        boostDays: option.days.toString(),
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      amount: option.price,
      plan: option.label,
    });
  } catch (err) {
    console.error('Boost payment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/boosts/options — Return available boost plans
router.get('/options', (req, res) => {
  const options = Object.entries(BOOST_OPTIONS).map(([key, val]) => ({
    id: key, ...val, price: val.price / 100,
  }));
  res.json({ options });
});

module.exports = router;
