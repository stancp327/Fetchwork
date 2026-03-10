const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const WATERMARKED_DIR = path.join(UPLOADS_DIR, 'watermarked');
const ORIGINALS_DIR = path.join(UPLOADS_DIR, 'originals');

const USE_CLOUDINARY = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

// Ensure local directories exist (used when Cloudinary not configured)
[WATERMARKED_DIR, ORIGINALS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ── Cloudinary URL-based watermark ───────────────────────────────
// Instead of processing locally we append a Cloudinary transformation to the URL.
// Original: https://res.cloudinary.com/{cloud}/image/upload/{public_id}
// Watermarked: appends /l_text:Arial_40_bold:FETCHWORK,o_20,a_-30,co_white/
function buildCloudinaryWatermarkUrl(originalUrl) {
  if (!originalUrl || !originalUrl.includes('cloudinary.com')) return originalUrl;
  // Insert transformation before the public_id segment (after /upload/)
  return originalUrl.replace(
    '/upload/',
    '/upload/l_text:Arial_40_bold:FETCHWORK,o_20,a_-30,co_white,g_center/'
  );
}

/**
 * Generate a text-based watermark SVG overlay.
 * Uses "FETCHWORK" text tiled diagonally across the image.
 */
function createWatermarkSvg(width, height) {
  const fontSize = Math.max(24, Math.min(width, height) * 0.06);
  const spacing = fontSize * 4;
  const rows = Math.ceil(height / spacing) + 2;
  const cols = Math.ceil(width / spacing) + 2;

  let textElements = '';
  for (let r = -1; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      const x = c * spacing;
      const y = r * spacing;
      textElements += `<text x="${x}" y="${y}" font-size="${fontSize}" font-family="Arial, sans-serif" 
        font-weight="bold" fill="rgba(255,255,255,0.25)" 
        transform="rotate(-30 ${x} ${y})">FETCHWORK</text>`;
    }
  }

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      ${textElements}
    </svg>
  `);
}

/**
 * Apply watermark to an image file.
 * Saves original to originals/ and watermarked version to watermarked/.
 * Returns the watermarked file path.
 */
async function applyWatermark(filePath, filename) {
  const ext = path.extname(filename).toLowerCase();
  const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  
  if (!imageExts.includes(ext)) {
    // Not an image — skip watermarking
    return { watermarked: false, path: filePath };
  }

  try {
    const originalPath = path.join(ORIGINALS_DIR, filename);
    const watermarkedPath = path.join(WATERMARKED_DIR, filename);

    // Copy original to originals/ for safekeeping
    fs.copyFileSync(filePath, originalPath);

    // Get image dimensions
    const metadata = await sharp(filePath).metadata();
    const { width, height } = metadata;

    if (!width || !height) {
      return { watermarked: false, path: filePath };
    }

    // Create watermark overlay
    const watermarkSvg = createWatermarkSvg(width, height);

    // Composite watermark onto image
    await sharp(filePath)
      .composite([{
        input: watermarkSvg,
        top: 0,
        left: 0,
      }])
      .toFile(watermarkedPath);

    return {
      watermarked: true,
      path: watermarkedPath,
      originalPath,
      url: `/uploads/watermarked/${filename}`,
      originalUrl: `/uploads/originals/${filename}`,
    };
  } catch (err) {
    console.error('Watermark failed for', filename, err.message);
    return { watermarked: false, path: filePath };
  }
}

/**
 * Process all attachments in a message — watermark images, leave docs alone.
 * Returns updated attachments array with watermarked URLs.
 *
 * Cloudinary path: watermark is a URL transformation (no local processing).
 * Local path: watermark applied via sharp.
 */
async function watermarkAttachments(files, filenames) {
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filename = filenames?.[i] || file.filename;
    const isImage = file.mimetype?.startsWith('image/');

    if (USE_CLOUDINARY) {
      // Cloudinary: file.path is the public Cloudinary URL
      const originalUrl = file.path || file.secure_url || '';
      if (isImage && originalUrl) {
        const watermarkedUrl = buildCloudinaryWatermarkUrl(originalUrl);
        results.push({
          filename: file.originalname || filename,
          url: watermarkedUrl,          // served until job complete
          originalUrl,                  // restored when job completes
          size: file.size,
          mimeType: file.mimetype,
          watermarked: true,
        });
      } else {
        results.push({
          filename: file.originalname || filename,
          url: originalUrl,
          originalUrl: null,
          size: file.size,
          mimeType: file.mimetype,
          watermarked: false,
        });
      }
    } else {
      // Local disk path (dev / no Cloudinary)
      const filePath = file.path || path.join(UPLOADS_DIR, file.filename);
      if (isImage) {
        const result = await applyWatermark(filePath, filename);
        results.push({
          filename: file.originalname || filename,
          url: result.watermarked ? result.url : `/uploads/${file.filename}`,
          originalUrl: result.watermarked ? result.originalUrl : null,
          size: file.size,
          mimeType: file.mimetype,
          watermarked: result.watermarked,
        });
      } else {
        results.push({
          filename: file.originalname || filename,
          url: `/uploads/${file.filename}`,
          originalUrl: null,
          size: file.size,
          mimeType: file.mimetype,
          watermarked: false,
        });
      }
    }
  }

  return results;
}

/**
 * Remove watermarks from all message attachments for a job.
 * Called when job status changes to 'completed'.
 */
async function removeWatermarksForJob(jobId) {
  const { Message, Conversation } = require('../models/Message');
  
  try {
    // Find conversation for this job
    const conversation = await Conversation.findOne({ job: jobId });
    if (!conversation) return { updated: 0 };

    // Find messages with watermarked attachments
    const messages = await Message.find({
      conversation: conversation._id,
      'attachments.watermarked': true,
    });

    let updated = 0;
    for (const msg of messages) {
      let changed = false;
      msg.attachments = msg.attachments.map(att => {
        if (att.watermarked && att.originalUrl) {
          changed = true;
          return { ...att.toObject(), url: att.originalUrl, watermarked: false };
        }
        return att;
      });
      if (changed) {
        msg.markModified('attachments');
        await msg.save();
        updated++;
      }
    }

    return { updated };
  } catch (err) {
    console.error('Error removing watermarks for job', jobId, err.message);
    return { updated: 0, error: err.message };
  }
}

module.exports = {
  watermarkAttachments,
  removeWatermarksForJob,
};
