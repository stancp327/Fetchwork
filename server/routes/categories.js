const express = require('express');
const router = express.Router();
const { CATEGORIES, getRemoteCategories, getLocalCategories, getCategoryById } = require('../config/categories');

// GET /api/categories — all categories
router.get('/', (req, res) => {
  // Optional filter: ?type=remote or ?type=local
  if (req.query.type === 'remote') {
    return res.json({ categories: getRemoteCategories() });
  }
  if (req.query.type === 'local') {
    return res.json({ categories: getLocalCategories() });
  }
  res.json({ categories: CATEGORIES });
});

// GET /api/categories/:id — single category with subcategories
router.get('/:id', (req, res) => {
  const category = getCategoryById(req.params.id);
  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }
  res.json({ category });
});

module.exports = router;
