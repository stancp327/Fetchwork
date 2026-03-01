const express    = require('express');
const router     = express.Router();
const JobAlert   = require('../models/JobAlert');
const Job        = require('../models/Job');
const Notification = require('../models/Notification');
const { authenticateToken } = require('../middleware/auth');

// ── GET /api/job-alerts — list my alerts ─────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    const alerts = await JobAlert.find({ user: req.user.userId }).sort({ createdAt: -1 }).lean();
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch job alerts' });
  }
});

// ── POST /api/job-alerts — create alert ──────────────────────────
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, filters, frequency } = req.body;

    // Max 10 alerts per user
    const count = await JobAlert.countDocuments({ user: req.user.userId });
    if (count >= 10) return res.status(400).json({ error: 'Maximum 10 job alerts allowed' });

    const alert = await JobAlert.create({
      user:      req.user.userId,
      name:      name || 'Job Alert',
      filters:   filters || {},
      frequency: frequency || 'instant',
    });
    res.status(201).json(alert);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create job alert' });
  }
});

// ── PUT /api/job-alerts/:id — update / toggle ────────────────────
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const alert = await JobAlert.findOne({ _id: req.params.id, user: req.user.userId });
    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    const { name, filters, frequency, active } = req.body;
    if (name      !== undefined) alert.name      = name;
    if (filters   !== undefined) alert.filters   = { ...alert.filters, ...filters };
    if (frequency !== undefined) alert.frequency = frequency;
    if (active    !== undefined) alert.active    = active;

    await alert.save();
    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update job alert' });
  }
});

// ── DELETE /api/job-alerts/:id ───────────────────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await JobAlert.deleteOne({ _id: req.params.id, user: req.user.userId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Alert not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete job alert' });
  }
});

// ── Exported helper: fire instant alerts for a new job ───────────
// Called async (fire-and-forget) after a new job is posted
async function checkJobAlerts(job) {
  try {
    const alerts = await JobAlert.find({ active: true, frequency: 'instant' }).lean();
    if (!alerts.length) return;

    const notifications = [];
    const matchedAlertIds = [];

    for (const alert of alerts) {
      // Skip alert owner if they're also the client (shouldn't match their own job)
      if (String(alert.user) === String(job.client)) continue;

      const f = alert.filters || {};

      // Category filter
      if (f.category && job.category !== f.category) continue;

      // Budget filter (use budget.amount for fixed, budget.max for range)
      const jobBudget = job.budget?.amount || job.budget?.max || 0;
      if (f.budgetMin && jobBudget < f.budgetMin) continue;
      if (f.budgetMax && jobBudget > f.budgetMax) continue;

      // Location filter — only apply if job has a city (remote jobs skip location checks)
      if (f.location && job.location?.city) {
        const loc = (job.location.city || '').toLowerCase();
        if (!loc.includes(f.location.toLowerCase())) continue;
      }

      // Keywords filter (match any keyword in title or description)
      if (f.keywords) {
        const kws = f.keywords.toLowerCase().split(/[,\s]+/).filter(Boolean);
        const haystack = `${job.title} ${job.description}`.toLowerCase();
        if (!kws.some(kw => haystack.includes(kw))) continue;
      }

      notifications.push({
        recipient: alert.user,
        type:      'job_alert',
        title:     'New job matches your alert',
        message:   `🔔 New job matching "${alert.name}": ${job.title}`,
        link:      `/jobs/${job._id}`,
      });
      matchedAlertIds.push(alert._id);
    }

    if (notifications.length) {
      await Notification.insertMany(notifications);
      // Update lastTriggered only on alerts that actually matched
      await JobAlert.updateMany({ _id: { $in: matchedAlertIds } }, { lastTriggered: new Date() });
    }
  } catch (err) {
    console.error('checkJobAlerts error:', err.message);
  }
}

module.exports = router;
module.exports.checkJobAlerts = checkJobAlerts;
