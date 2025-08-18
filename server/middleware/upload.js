const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');

if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'text/plain': ['.txt'],
    'video/mp4': ['.mp4'],
    'video/quicktime': ['.mov']
  };

  if (allowedTypes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, PDFs, documents, and select videos (mp4, mov) are allowed.'), false);
  }
};

const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'fetchwork',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }]
  }
});

const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadProfilePicture = multer({
  storage: process.env.CLOUDINARY_URL ? cloudinaryStorage : localStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
}).single('profilePicture');

const uploadPortfolio = multer({
  storage: localStorage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }
}).array('files', 10);

const uploadJobAttachments = multer({
  storage: localStorage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
}).array('attachments', 5);

const uploadDisputeEvidence = multer({
  storage: localStorage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
}).array('evidence', 3);

module.exports = {
  uploadProfilePicture,
  uploadJobAttachments,
  uploadDisputeEvidence,
  uploadPortfolio
};
