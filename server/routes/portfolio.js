const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const { uploadPortfolio } = require('../middleware/upload');
const { tileWatermark } = require('../services/mediaService');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const User = require('../models/User');
const mongoose = require('mongoose');

// POST /api/portfolio — add a portfolio item
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description, mediaUrls, mediaType, links } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const item = {
      title: title.trim(),
      description: description || '',
      mediaUrls: Array.isArray(mediaUrls) ? mediaUrls.filter(Boolean) : [],
      mediaType: mediaType || 'image',
      links: Array.isArray(links) ? links.filter(Boolean) : [],
    };

    const user = await User.findByIdAndUpdate(
      req.user.userId || req.user._id,
      { $push: { portfolio: item } },
      { new: true, select: 'portfolio' }
    );

    const added = user.portfolio[user.portfolio.length - 1];
    res.status(201).json({ portfolioItem: added, portfolio: user.portfolio });
  } catch (err) {
    console.error('Portfolio create error:', err);
    res.status(500).json({ error: 'Failed to create portfolio item' });
  }
});

// PUT /api/portfolio — update a portfolio item
router.put('/', authenticateToken, async (req, res) => {
  try {
    const { portfolioId, title, description, mediaUrls, mediaType, links } = req.body;
    if (!portfolioId) return res.status(400).json({ error: 'portfolioId is required' });
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const user = await User.findOneAndUpdate(
      { _id: req.user.userId || req.user._id, 'portfolio._id': portfolioId },
      {
        $set: {
          'portfolio.$.title': title.trim(),
          'portfolio.$.description': description || '',
          'portfolio.$.mediaUrls': Array.isArray(mediaUrls) ? mediaUrls.filter(Boolean) : [],
          'portfolio.$.mediaType': mediaType || 'image',
          'portfolio.$.links': Array.isArray(links) ? links.filter(Boolean) : [],
        }
      },
      { new: true, select: 'portfolio' }
    );

    if (!user) return res.status(404).json({ error: 'Portfolio item not found' });

    const updated = user.portfolio.find(p => p._id.toString() === portfolioId);
    res.json({ portfolioItem: updated, portfolio: user.portfolio });
  } catch (err) {
    console.error('Portfolio update error:', err);
    res.status(500).json({ error: 'Failed to update portfolio item' });
  }
});

// DELETE /api/portfolio/:id — remove a portfolio item
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.userId || req.user._id,
      { $pull: { portfolio: { _id: new mongoose.Types.ObjectId(req.params.id) } } },
      { new: true, select: 'portfolio' }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Portfolio item deleted', portfolio: user.portfolio });
  } catch (err) {
    console.error('Portfolio delete error:', err);
    res.status(500).json({ error: 'Failed to delete portfolio item' });
  }
});

// POST /api/portfolio/upload — upload media files
router.post('/upload', authenticateToken, uploadPortfolio, async (req, res) => {
  try {
    const watermark = (req.query.watermark || 'false') === 'true';
    const files = req.files || [];
    const userId = req.user.userId;
    const outUrls = [];

    for (const f of files) {
      try {
        const ext = path.extname(f.filename).toLowerCase();
        const isImage = ['.jpg','.jpeg','.png','.gif'].includes(ext);
        const userDir = path.join('uploads', String(userId));
        ensureDir(userDir);

        const inputPath = f.path;
        let finalPath = inputPath;
        if (watermark && isImage) {
          const outPath = path.join(userDir, `wm-${Date.now()}-${f.filename}`);
          try {
            await tileWatermark(inputPath, outPath, 'FetchWork', 0.3);
            try { fs.unlinkSync(inputPath); } catch {}
            finalPath = outPath;
          } catch (wmErr) {
            console.error('Watermark failed, falling back to plain save:', wmErr && wmErr.message ? wmErr.message : wmErr);
            const moved = path.join(userDir, f.filename);
            fs.renameSync(inputPath, moved);
            finalPath = moved;
          }
        } else {
          const moved = path.join(userDir, f.filename);
          fs.renameSync(inputPath, moved);
          finalPath = moved;
        }
        outUrls.push('/' + finalPath.replace(/\\/g,'/'));
      } catch (perFileErr) {
        console.error('Per-file upload processing error:', perFileErr && perFileErr.message ? perFileErr.message : perFileErr);
      }
    }

    res.json({ files: outUrls });
  } catch (e) {
    console.error('Portfolio upload failed:', e && e.message ? e.message : e);
    res.status(500).json({ error: 'Upload failed: server error' });
  }
});

module.exports = router;
