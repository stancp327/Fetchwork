const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

// ── Storage setup (mirrors pattern from middleware/upload.js) ───
const hasCloudinary = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

function ensureDir(dir) {
  try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
}

const cloudinaryStorage = hasCloudinary
  ? new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: 'fetchwork/uploads',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
        resource_type: 'auto',
      },
    })
  : null;

const localDiskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const base = 'uploads/';
    ensureDir(base);
    cb(null, base);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: jpg, png, gif, pdf, doc, docx.'), false);
  }
};

const upload = multer({
  storage: cloudinaryStorage || localDiskStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).array('files', 5);

// POST /api/upload
router.post('/', authenticateToken, (req, res) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    const results = req.files.map((file) => {
      const url = hasCloudinary
        ? file.path                          // Cloudinary URL
        : `/uploads/${file.filename}`;       // local fallback

      return {
        url,
        filename: file.originalname,
        size: file.size,
        contentType: file.mimetype,
      };
    });

    res.json(results);
  });
});

module.exports = router;
