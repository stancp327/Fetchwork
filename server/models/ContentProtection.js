const mongoose = require('mongoose');

const digitalAssetSchema = new mongoose.Schema({
  assetId: {
    type: String,
    required: true,
    unique: true
  },
  originalFilename: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true,
    enum: ['image', 'video', 'document', 'audio', 'other']
  },
  fileSize: {
    type: Number,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job'
  },
  watermarkApplied: {
    type: Boolean,
    default: false
  },
  watermarkSettings: {
    text: String,
    opacity: {
      type: Number,
      default: 0.5,
      min: 0.1,
      max: 1.0
    },
    position: {
      type: String,
      enum: ['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
      default: 'center'
    },
    fontSize: {
      type: Number,
      default: 24
    }
  },
  protectionLevel: {
    type: String,
    enum: ['basic', 'standard', 'premium'],
    default: 'standard'
  },
  downloadRestrictions: {
    maxDownloads: {
      type: Number,
      default: 3
    },
    currentDownloads: {
      type: Number,
      default: 0
    },
    allowedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  accessLog: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    action: {
      type: String,
      enum: ['view', 'download', 'share', 'unauthorized_access']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String
  }],
  securityFlags: {
    suspiciousActivity: {
      type: Boolean,
      default: false
    },
    reportedTheft: {
      type: Boolean,
      default: false
    },
    blockedAccess: {
      type: Boolean,
      default: false
    }
  },
  metadata: {
    originalHash: String,
    protectedHash: String,
    encryptionKey: String,
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastModified: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true
});

const theftReportSchema = new mongoose.Schema({
  reportId: {
    type: String,
    required: true,
    unique: true
  },
  assetId: {
    type: String,
    required: true
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  theftType: {
    type: String,
    enum: ['unauthorized_download', 'copyright_infringement', 'watermark_removal', 'redistribution'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  evidence: [{
    type: String,
    url: String,
    description: String
  }],
  status: {
    type: String,
    enum: ['pending', 'investigating', 'resolved', 'dismissed'],
    default: 'pending'
  },
  investigationNotes: [{
    note: String,
    investigator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  resolution: {
    action: {
      type: String,
      enum: ['content_removed', 'user_warned', 'user_suspended', 'legal_action', 'no_action']
    },
    details: String,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date
  }
}, {
  timestamps: true
});

digitalAssetSchema.index({ uploadedBy: 1, createdAt: -1 });
digitalAssetSchema.index({ jobId: 1 });
digitalAssetSchema.index({ 'securityFlags.suspiciousActivity': 1 });

theftReportSchema.index({ reportedBy: 1, createdAt: -1 });
theftReportSchema.index({ status: 1 });

const DigitalAsset = mongoose.model('DigitalAsset', digitalAssetSchema);
const TheftReport = mongoose.model('TheftReport', theftReportSchema);

module.exports = { DigitalAsset, TheftReport };
