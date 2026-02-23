const express = require('express');
const router = express.Router();
const Saved = require('../models/Saved');
const { authenticateToken } = require('../middleware/auth');

const TYPE_MAP = { freelancer: 'User', job: 'Job', service: 'Service' };

// GET /api/saved — list saved items
router.get('/', authenticateToken, async (req, res) => {
  try {
    const type = req.query.type;
    const filters = { user: req.user.userId };
    if (type && TYPE_MAP[type]) filters.itemType = type;

    const saved = await Saved.find(filters)
      .populate('item')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ saved });
  } catch (error) {
    console.error('Error fetching saved:', error);
    res.status(500).json({ error: 'Failed to fetch saved items' });
  }
});

// POST /api/saved — save an item
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { itemId, itemType, note } = req.body;
    if (!itemId || !itemType || !TYPE_MAP[itemType]) {
      return res.status(400).json({ error: 'itemId and itemType (freelancer/job/service) required' });
    }

    const existing = await Saved.findOne({ user: req.user.userId, item: itemId });
    if (existing) return res.status(400).json({ error: 'Already saved' });

    const saved = new Saved({
      user: req.user.userId,
      item: itemId,
      itemType,
      itemModel: TYPE_MAP[itemType],
      note: note || ''
    });
    await saved.save();
    res.status(201).json({ message: 'Saved', saved });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ error: 'Already saved' });
    console.error('Error saving item:', error);
    res.status(500).json({ error: 'Failed to save item' });
  }
});

// DELETE /api/saved/:itemId — unsave
router.delete('/:itemId', authenticateToken, async (req, res) => {
  try {
    await Saved.findOneAndDelete({ user: req.user.userId, item: req.params.itemId });
    res.json({ message: 'Removed from saved' });
  } catch (error) {
    console.error('Error removing saved:', error);
    res.status(500).json({ error: 'Failed to remove saved item' });
  }
});

// GET /api/saved/check/:itemId — is this item saved?
router.get('/check/:itemId', authenticateToken, async (req, res) => {
  try {
    const saved = await Saved.findOne({ user: req.user.userId, item: req.params.itemId });
    res.json({ isSaved: !!saved });
  } catch (error) {
    res.json({ isSaved: false });
  }
});

module.exports = router;
