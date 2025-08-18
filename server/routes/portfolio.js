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
