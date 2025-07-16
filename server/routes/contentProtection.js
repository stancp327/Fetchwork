const express = require('express');
const router = express.Router();
const { DigitalAsset, TheftReport } = require('../models/ContentProtection');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const mockWatermarkService = {
  applyWatermark: async (fileBuffer, settings) => {
    console.log(`Applying watermark with settings:`, settings);
    return {
      success: true,
      watermarkedBuffer: fileBuffer, // In reality, this would be the watermarked file
      watermarkHash: `wm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  },
  
  detectWatermarkRemoval: async (originalHash, currentBuffer) => {
    const hasWatermark = Math.random() > 0.1; // 90% chance watermark is still present
    return {
      watermarkPresent: hasWatermark,
      confidence: hasWatermark ? 0.95 : 0.05,
      suspiciousActivity: !hasWatermark
    };
  }
};

router.post('/upload', auth, async (req, res) => {
  try {
    const {
      originalFilename,
      fileType,
      fileSize,
      jobId,
      protectionLevel = 'standard',
      watermarkText
    } = req.body;

    const assetId = uuidv4();
    
    const mockFileBuffer = Buffer.from('mock file content');
    
    const watermarkSettings = {
      text: watermarkText || `© FetchWork - ${req.user.email}`,
      opacity: 0.5,
      position: 'center',
      fontSize: 24
    };
    
    const watermarkResult = await mockWatermarkService.applyWatermark(
      mockFileBuffer, 
      watermarkSettings
    );

    const digitalAsset = new DigitalAsset({
      assetId,
      originalFilename,
      fileType,
      fileSize,
      uploadedBy: req.user.userId,
      jobId,
      watermarkApplied: watermarkResult.success,
      watermarkSettings,
      protectionLevel,
      metadata: {
        originalHash: `orig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        protectedHash: watermarkResult.watermarkHash,
        encryptionKey: `enc_${uuidv4()}`
      }
    });

    await digitalAsset.save();

    digitalAsset.accessLog.push({
      userId: req.user.userId,
      action: 'upload',
      timestamp: new Date(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    await digitalAsset.save();

    res.status(201).json({
      success: true,
      message: 'Digital asset uploaded and protected successfully',
      assetId: digitalAsset.assetId,
      watermarkApplied: digitalAsset.watermarkApplied,
      protectionLevel: digitalAsset.protectionLevel
    });

  } catch (error) {
    console.error('Error uploading digital asset:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload and protect digital asset',
      error: error.message
    });
  }
});

router.get('/assets', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, jobId } = req.query;
    
    const query = { uploadedBy: req.user.userId };
    if (jobId) {
      query.jobId = jobId;
    }

    const assets = await DigitalAsset.find(query)
      .populate('jobId', 'title')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await DigitalAsset.countDocuments(query);

    res.json({
      success: true,
      assets: assets.map(asset => ({
        assetId: asset.assetId,
        originalFilename: asset.originalFilename,
        fileType: asset.fileType,
        fileSize: asset.fileSize,
        watermarkApplied: asset.watermarkApplied,
        protectionLevel: asset.protectionLevel,
        downloadCount: asset.downloadRestrictions.currentDownloads,
        maxDownloads: asset.downloadRestrictions.maxDownloads,
        createdAt: asset.createdAt,
        jobTitle: asset.jobId?.title,
        securityFlags: asset.securityFlags
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalAssets: total
      }
    });

  } catch (error) {
    console.error('Error fetching digital assets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch digital assets',
      error: error.message
    });
  }
});

router.get('/download/:assetId', auth, async (req, res) => {
  try {
    const { assetId } = req.params;
    
    const asset = await DigitalAsset.findOne({ assetId });
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Digital asset not found'
      });
    }

    const isOwner = asset.uploadedBy.toString() === req.user.userId;
    const isAllowedUser = asset.downloadRestrictions.allowedUsers.includes(req.user.userId);
    
    if (!isOwner && !isAllowedUser) {
      asset.accessLog.push({
        userId: req.user.userId,
        action: 'unauthorized_access',
        timestamp: new Date(),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      asset.securityFlags.suspiciousActivity = true;
      await asset.save();
      
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to download this asset'
      });
    }

    if (asset.downloadRestrictions.currentDownloads >= asset.downloadRestrictions.maxDownloads && !isOwner) {
      return res.status(429).json({
        success: false,
        message: 'Download limit exceeded for this asset'
      });
    }

    const mockFileBuffer = Buffer.from('mock protected file content');
    const integrityCheck = await mockWatermarkService.detectWatermarkRemoval(
      asset.metadata.originalHash,
      mockFileBuffer
    );

    if (!integrityCheck.watermarkPresent) {
      asset.securityFlags.suspiciousActivity = true;
      asset.securityFlags.reportedTheft = true;
      await asset.save();
      
      return res.status(410).json({
        success: false,
        message: 'Asset integrity compromised: Watermark tampering detected'
      });
    }

    if (!isOwner) {
      asset.downloadRestrictions.currentDownloads += 1;
    }
    
    asset.accessLog.push({
      userId: req.user.userId,
      action: 'download',
      timestamp: new Date(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    await asset.save();

    res.json({
      success: true,
      message: 'Asset download authorized',
      downloadUrl: `/protected-files/${assetId}`, // Mock download URL
      filename: asset.originalFilename,
      watermarkIntegrity: integrityCheck.confidence,
      remainingDownloads: Math.max(0, asset.downloadRestrictions.maxDownloads - asset.downloadRestrictions.currentDownloads)
    });

  } catch (error) {
    console.error('Error downloading digital asset:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download digital asset',
      error: error.message
    });
  }
});

router.post('/report-theft', auth, async (req, res) => {
  try {
    const {
      assetId,
      theftType,
      description,
      evidence = []
    } = req.body;

    const asset = await DigitalAsset.findOne({ assetId });
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Digital asset not found'
      });
    }

    const isOwner = asset.uploadedBy.toString() === req.user.userId;
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Only the asset owner can report theft'
      });
    }

    const reportId = `TR_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const theftReport = new TheftReport({
      reportId,
      assetId,
      reportedBy: req.user.userId,
      theftType,
      description,
      evidence
    });

    await theftReport.save();

    asset.securityFlags.reportedTheft = true;
    asset.securityFlags.suspiciousActivity = true;
    await asset.save();

    res.status(201).json({
      success: true,
      message: 'Theft report submitted successfully',
      reportId: theftReport.reportId,
      status: theftReport.status
    });

  } catch (error) {
    console.error('Error reporting theft:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit theft report',
      error: error.message
    });
  }
});

router.get('/theft-reports', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = { reportedBy: req.user.userId };
    if (status) {
      query.status = status;
    }

    const reports = await TheftReport.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await TheftReport.countDocuments(query);

    res.json({
      success: true,
      reports: reports.map(report => ({
        reportId: report.reportId,
        assetId: report.assetId,
        theftType: report.theftType,
        description: report.description,
        status: report.status,
        createdAt: report.createdAt,
        resolution: report.resolution
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalReports: total
      }
    });

  } catch (error) {
    console.error('Error fetching theft reports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch theft reports',
      error: error.message
    });
  }
});

router.get('/admin/theft-reports', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    const query = {};
    if (status) {
      query.status = status;
    }

    const reports = await TheftReport.find(query)
      .populate('reportedBy', 'email firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await TheftReport.countDocuments(query);

    res.json({
      success: true,
      reports,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalReports: total
      }
    });

  } catch (error) {
    console.error('Error fetching admin theft reports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch theft reports',
      error: error.message
    });
  }
});

router.put('/admin/theft-reports/:reportId', auth, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, investigationNote, resolution } = req.body;

    const report = await TheftReport.findOne({ reportId });
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Theft report not found'
      });
    }

    if (status) {
      report.status = status;
    }

    if (investigationNote) {
      report.investigationNotes.push({
        note: investigationNote,
        investigator: req.user.userId,
        timestamp: new Date()
      });
    }

    if (resolution && status === 'resolved') {
      report.resolution = {
        ...resolution,
        resolvedBy: req.user.userId,
        resolvedAt: new Date()
      };
    }

    await report.save();

    res.json({
      success: true,
      message: 'Theft report updated successfully',
      report
    });

  } catch (error) {
    console.error('Error updating theft report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update theft report',
      error: error.message
    });
  }
});

module.exports = router;
