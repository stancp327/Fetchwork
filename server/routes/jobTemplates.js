const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireFeature } = require('../middleware/entitlements');
const JobTemplate = require('../models/JobTemplate');

// All routes require auth + job_templates feature
router.use(authenticateToken);
router.use(requireFeature('job_templates'));

// GET /api/job-templates — list user's templates
router.get('/', async (req, res) => {
  try {
    const templates = await JobTemplate.find({ user: req.user.userId })
      .sort({ updatedAt: -1 }).lean();
    res.json({ templates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/job-templates — create a template
router.post('/', async (req, res) => {
  try {
    const { name, title, description, category, subcategory, skills, budgetType, budgetMin, budgetMax, location, requirements } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Template name is required' });

    const template = await JobTemplate.create({
      user: req.user.userId,
      name: name.trim(), title, description, category, subcategory,
      skills: skills || [], budgetType, budgetMin, budgetMax,
      location, requirements,
    });
    res.status(201).json({ message: 'Template saved', template });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/job-templates/:id — update
router.put('/:id', async (req, res) => {
  try {
    const template = await JobTemplate.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId },
      { $set: req.body },
      { new: true }
    );
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json({ message: 'Template updated', template });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/job-templates/:id
router.delete('/:id', async (req, res) => {
  try {
    await JobTemplate.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
    res.json({ message: 'Template deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/job-templates/:id/use — increment usage counter + return template data
router.post('/:id/use', async (req, res) => {
  try {
    const template = await JobTemplate.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId },
      { $inc: { usageCount: 1 } },
      { new: true }
    );
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json({ template });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
