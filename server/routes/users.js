const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Job = require('../models/Job');
const Payment = require('../models/Payment');
const { Message } = require('../models/Message');
const { authenticateToken } = require('../middleware/auth');
const { uploadProfilePicture, uploadVerificationDocs } = require('../middleware/upload');
const { validateProfilePictureUpdate } = require('../middleware/validation');
const { normalize, isValid } = require('../utils/username');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
function computeProfileCompletion(user) {
  let total = 0;
  let achieved = 0;
  const checks = [
    Boolean(user.profilePicture),
    Boolean(user.headline && user.headline.trim().length >= 3),
    Array.isArray(user.skills) && user.skills.length >= 5,
    Array.isArray(user.portfolio) && user.portfolio.length > 0,
    Number(user.hourlyRate) > 0 || (user.preferencesExtended && (user.preferencesExtended.rateType === 'fixed')),
    Boolean(user.username && user.username.trim().length > 0),
    Boolean(user.bio && user.bio.trim().length >= 30)
  ];
  total = checks.length;
  achieved = checks.filter(Boolean).length;
  const pct = Math.round((achieved / Math.max(total, 1)) * 100);
  return Math.max(0, Math.min(100, pct));
}


router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const activeJobsAsClient = await Job.countDocuments({
      client: userId,
      status: { $in: ['open', 'in_progress'] },
      isActive: true
    });
    
    const activeJobsAsFreelancer = await Job.countDocuments({
      freelancer: userId,
      status: 'in_progress',
      isActive: true
    });
    
    const totalEarnings = await Payment.aggregate([
      {
        $match: {
          freelancer: userId,
          status: 'completed',
          type: { $in: ['release', 'bonus'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$netAmount' }
        }
      }
    ]);
    
    const totalSpent = await Payment.aggregate([
      {
        $match: {
          client: userId,
          status: 'completed',
          type: { $in: ['escrow', 'bonus'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    
    const unreadMessages = await Message.countDocuments({
      recipient: userId,
      isRead: false,
      isDeleted: false
    });
    
    const recentJobsAsClient = await Job.find({
      client: userId,
      isActive: true
    })
    .populate('freelancer', 'firstName lastName profilePicture')
    .sort({ createdAt: -1 })
    .limit(5);
    
    const recentJobsAsFreelancer = await Job.find({
      freelancer: userId,
      isActive: true
    })
    .populate('client', 'firstName lastName profilePicture')
    .sort({ createdAt: -1 })
    .limit(5);
    
    const pendingProposals = await Job.aggregate([
      {
        $match: {
          'proposals.freelancer': userId,
          'proposals.status': 'pending',
          isActive: true
        }
      },
      {
        $project: {
          title: 1,
          budget: 1,
          createdAt: 1,
          proposals: {
            $filter: {
              input: '$proposals',
              cond: { $eq: ['$$this.freelancer', userId] }
            }
          }
        }
      }
    ]);

    const proposalsReceived = await Job.find({
      client: userId,
      isActive: true,
      status: 'open',
      'proposals.0': { $exists: true } // Has at least one proposal
    })
    .populate('proposals.freelancer', 'firstName lastName profilePicture rating totalJobs')
    .sort({ 'proposals.submittedAt': -1 })
    .limit(5);
    
    const dashboardData = {
      stats: {
        activeJobsAsClient,
        activeJobsAsFreelancer,
        totalEarnings: totalEarnings[0]?.total || 0,
        totalSpent: totalSpent[0]?.total || 0,
        unreadMessages,
        pendingProposals:      pendingProposals.length,      // proposals I submitted (freelancer view)
        proposalsReceived:     proposalsReceived.length,     // proposals on my jobs (client view)
      },
      recentActivity: {
        jobsAsClient: recentJobsAsClient,
        jobsAsFreelancer: recentJobsAsFreelancer,
        pendingProposals,
        proposalsReceived
      }
    };
    
    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: user.getPublicProfile() });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.get('/username-availability', authenticateToken, async (req, res) => {
  try {
    const raw = req.query.username || '';
    const username = normalize(raw);
    if (!isValid(username)) {
      return res.json({ available: false, reason: 'invalid' });
    }
    const exists = await User.findOne({ username }).select('_id').lean();
    if (exists) {
      return res.json({ available: false, reason: 'taken' });
    }
    return res.json({ available: true });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to check availability' });
  }
});

router.put('/me/username', authenticateToken, async (req, res) => {
  try {
    const raw = req.body.username || '';
    const username = normalize(raw);
    if (!isValid(username)) {
      return res.status(400).json({ error: 'Invalid username' });
    }
    const exists = await User.findOne({ username, _id: { $ne: req.user.userId } }).select('_id').lean();
    if (exists) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.username = username;
    user.profileCompletion = computeProfileCompletion(user);
    if (user.profileCompletion >= 80) {
      user.badges = Array.isArray(user.badges) ? user.badges : [];
      if (!user.badges.includes('Rising Star')) user.badges.push('Rising Star');
    }
    await user.save();
    return res.json({ username });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to set username' });
  }
});
const maybeUploadProfilePicture = (req, res, next) => {
  try {
    const ct = req.headers['content-type'] || '';
    if (ct.includes('multipart/form-data')) {
      return uploadProfilePicture(req, res, next);
    }
    return next();
  } catch (e) {
    return next();
  }
};


router.put('/profile', authenticateToken, maybeUploadProfilePicture, validateProfilePictureUpdate, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const clip = (v, n) => String(v || '').trim().slice(0, n);
    const sanitizeArray = (arr, mapFn) => Array.isArray(arr) ? arr.slice(0, 50).map(mapFn) : undefined;

    if (req.body.experience) {
      req.body.experience = sanitizeArray(req.body.experience, it => ({
        company: clip(it.company, 120),
        role: clip(it.role, 120),
        startDate: clip(it.startDate, 24),
        endDate: clip(it.endDate, 24),
        description: clip(it.description, 2000)
      }));
    }
    if (req.body.education) {
      req.body.education = sanitizeArray(req.body.education, it => ({
        school: clip(it.school, 160),
        degree: clip(it.degree, 160),
        startDate: clip(it.startDate, 24),
        endDate: clip(it.endDate, 24)
      }));
    }
    if (req.body.certifications) {
      req.body.certifications = sanitizeArray(req.body.certifications, it => ({
        name: clip(it.name, 200),
        issuer: clip(it.issuer, 160),
        date: clip(it.date, 24),
        credentialUrl: clip(it.credentialUrl, 400)
      }));
    }
    if (req.body.languages) {
      const allowed = new Set(['Beginner','Intermediate','Advanced','Native']);
      req.body.languages = sanitizeArray(req.body.languages, it => ({
        name: clip(it.name, 80),
        level: allowed.has(String(it.level || '').trim()) ? it.level : 'Intermediate'
      }));
    }
    if (req.body.skills) {
      req.body.skills = sanitizeArray(req.body.skills, it => clip(it, 60));
    }
    if (req.body.portfolio) {
      req.body.portfolio = sanitizeArray(req.body.portfolio, it => ({
        title: clip(it.title, 160),
        description: clip(it.description, 2000),
        mediaUrls: Array.isArray(it.mediaUrls) ? it.mediaUrls.slice(0, 10).map(u => clip(u, 400)) : [],
        mediaType: clip(it.mediaType, 40),
        links: Array.isArray(it.links) ? it.links.slice(0, 10).map(u => clip(u, 400)) : [],
        watermarked: !!it.watermarked
      }));
    }
    
    const allowedUpdates = [
      'firstName', 'lastName', 'bio', 'skills', 'hourlyRate',
      'location', 'timezone', 'portfolio', 'socialLinks', 'phone',
      'headline', 'tagline', 'languages', 'experience', 'education',
      'certifications', 'preferencesExtended', 'socialLinksExtended',
      'bannerUrl', 'visibility', 'modes',
      'interests', 'lookingFor'
    ];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'socialLinks' && typeof req.body[field] === 'object') {
          user[field] = { ...user[field], ...req.body[field] };
        } else {
          user[field] = req.body[field];
        }
      }
    });

    if (req.file) {
      user.profilePicture = req.file.path || req.file.secure_url || `/uploads/${req.file.filename}`;
    }
    
    user.profileCompletion = computeProfileCompletion(user);
    if (user.profileCompletion >= 80) {
      user.badges = Array.isArray(user.badges) ? user.badges : [];
      if (!user.badges.includes('Rising Star')) user.badges.push('Rising Star');
    }
    await user.save();
    
    res.json({
      message: 'Profile updated successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ── PUT /api/users/me/discovery — Update discovery/notification preferences
router.put('/me/discovery', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { enabled, notifyJobs, notifyServices, notifyClasses, categories, blockedProviders, frequency } = req.body;

    if (!user.preferences) user.preferences = {};
    user.preferences.discovery = {
      enabled:          enabled !== undefined ? enabled : user.preferences.discovery?.enabled || false,
      notifyJobs:       notifyJobs !== undefined ? notifyJobs : user.preferences.discovery?.notifyJobs ?? true,
      notifyServices:   notifyServices !== undefined ? notifyServices : user.preferences.discovery?.notifyServices ?? true,
      notifyClasses:    notifyClasses !== undefined ? notifyClasses : user.preferences.discovery?.notifyClasses ?? true,
      categories:       categories || user.preferences.discovery?.categories || [],
      blockedProviders: blockedProviders || user.preferences.discovery?.blockedProviders || [],
      frequency:        frequency || user.preferences.discovery?.frequency || 'daily',
    };

    user.markModified('preferences');
    await user.save();
    res.json({ message: 'Discovery preferences updated', discovery: user.preferences.discovery });
  } catch (err) {
    console.error('Discovery prefs error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/users/me/discovery — Get discovery preferences
router.get('/me/discovery', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('preferences.discovery interests lookingFor').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      discovery: user.preferences?.discovery || { enabled: false },
      interests: user.interests || [],
      lookingFor: user.lookingFor || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Batch online status — used by Messages sidebar ─────────────────────────
// GET /api/users/online-status?ids=id1,id2,id3
router.get('/online-status', authenticateToken, async (req, res) => {
  try {
    const ids = (req.query.ids || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 50);
    if (ids.length === 0) return res.json({ statuses: {} });

    const users = await User.find({ _id: { $in: ids } }).select('_id lastSeen').lean();

    const statuses = {};
    users.forEach(u => {
      const id = u._id.toString();
      statuses[id] = {
        isOnline: global.io?.isUserOnline?.(id) ?? false,
        lastSeen: u.lastSeen || null
      };
    });

    res.json({ statuses });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch online status' });
  }
});

router.get('/jobs', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const type = req.query.type || 'all';
    
    // Show active jobs + archived jobs (completed/past-deadline) — users keep access to their history
    // Cancelled/deactivated-for-other-reasons jobs are intentionally excluded
    let filters = {
      $or: [{ isActive: true }, { isArchived: true }]
    };

    if (type === 'posted') {
      filters.client = req.user.userId;
    } else if (type === 'working') {
      filters.freelancer = req.user.userId;
    } else if (type === 'applied') {
      filters['proposals.freelancer'] = req.user.userId;
    } else {
      // Merge with existing $or by wrapping everything
      const ownershipFilter = [
        { client: req.user.userId },
        { freelancer: req.user.userId },
        { 'proposals.freelancer': req.user.userId }
      ];
      filters = {
        $and: [
          { $or: [{ isActive: true }, { isArchived: true }] },
          { $or: ownershipFilter }
        ]
      };
    }
    
    const jobs = await Job.find(filters)
      .populate('client', 'firstName lastName profilePicture rating totalJobs')
      .populate('freelancer', 'firstName lastName profilePicture')
      .populate('proposals.freelancer', 'firstName lastName profilePicture rating totalJobs')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Job.countDocuments(filters);
    
    res.json({
      jobs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching user jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Submit ID verification
router.post('/verify-identity', authenticateToken, uploadVerificationDocs, async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.idVerification?.status === 'pending') {
      return res.status(400).json({ error: 'Verification already pending review' });
    }
    if (user.idVerification?.status === 'approved') {
      return res.status(400).json({ error: 'Already verified' });
    }

    const { documentType } = req.body;
    if (!documentType) {
      return res.status(400).json({ error: 'Document type is required' });
    }

    // Resolve document URL — uploaded file takes priority over URL string
    const docFile = req.files?.document?.[0];
    const selfieFile = req.files?.selfie?.[0];
    const documentUrl = docFile
      ? (docFile.secure_url || docFile.path || '')
      : (req.body.documentUrl || '');
    const selfieUrl = selfieFile
      ? (selfieFile.secure_url || selfieFile.path || '')
      : (req.body.selfieUrl || '');

    if (!documentUrl) {
      return res.status(400).json({ error: 'A document image or file is required' });
    }

    user.idVerification = {
      status: 'pending',
      documentType,
      documentUrl,
      selfieUrl,
      submittedAt: new Date(),
      reviewedBy: null,
      reviewedAt: null,
      notes: ''
    };
    await user.save();

    res.json({ message: 'Verification submitted. You will be notified once reviewed.', status: 'pending' });
  } catch (error) {
    console.error('ID verification submit error:', error);
    res.status(500).json({ error: 'Failed to submit verification' });
  }
});

// Get verification status
router.get('/verification-status', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.userId)
      .select('verificationLevel badges idVerification.status idVerification.submittedAt idVerification.notes isEmailVerified backgroundCheck.status');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      verificationLevel: user.verificationLevel,
      badges: user.badges,
      emailVerified: user.isEmailVerified,
      idVerification: user.idVerification?.status || 'none',
      backgroundCheck: user.backgroundCheck?.status || 'none'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get verification status' });
  }
});

// ── POST /api/users/push-token — register Expo push token ───────
router.post('/push-token', authenticateToken, async (req, res) => {
  const { token, deviceId } = req.body;
  if (!token || !deviceId) return res.status(400).json({ error: 'token and deviceId required' });
  try {
    const userId = req.user._id || req.user.userId;
    // Remove existing entry for this device, then add fresh one
    await User.findByIdAndUpdate(userId, { $pull: { expoPushTokens: { deviceId } } });
    await User.findByIdAndUpdate(userId, {
      $push: { expoPushTokens: { token, deviceId, addedAt: new Date() } }
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Push token register error:', err);
    res.status(500).json({ error: 'Failed to register push token' });
  }
});

// ── DELETE /api/users/push-token — unregister on logout ─────────
router.delete('/push-token', authenticateToken, async (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
  try {
    await User.findByIdAndUpdate(
      req.user._id || req.user.userId,
      { $pull: { expoPushTokens: { deviceId } } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Push token remove error:', err);
    res.status(500).json({ error: 'Failed to remove push token' });
  }
});

module.exports = router;
