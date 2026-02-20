const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const passport = require('passport');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../middleware/validation');
const { ADMIN_EMAILS, JWT_SECRET, CLIENT_URL } = require('../config/env');

// ── Register ────────────────────────────────────────────────────
router.post('/register', validateRegister, async (req, res) => {
  try {
    const { email, password, firstName, lastName, accountType } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const user = new User({ 
      email, 
      password, 
      firstName, 
      lastName,
      accountType: accountType || 'both',
      isVerified: false,
      emailVerificationToken: crypto.randomBytes(32).toString('hex'),
      emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000
    });
    
    try {
      await user.save();
    } catch (error) {
      if (error.code === 11000) {
        console.log(`⚠️  Duplicate key error for email: ${email}`);
        return res.status(400).json({ error: 'User already exists' });
      }
      throw error;
    }
    
    try {
      const emailService = require('../services/emailService');
      const emailWorkflowService = require('../services/emailWorkflowService');
      await emailService.sendEmailVerification(user, user.emailVerificationToken);
      setTimeout(() => emailWorkflowService.sendOnboardingSequence(user._id), 60000);
    } catch (emailError) {
      console.warn('Warning: Could not send verification email:', emailError.message);
    }
    
    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      requiresVerification: true
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Login ───────────────────────────────────────────────────────
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`🔐 Login attempt for: ${email}`);
    
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log(`❌ User not found: ${email}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log(`👤 User found: ${email}, created: ${user.createdAt}, verified: ${user.isVerified}`);
    
    const isValidPassword = await user.comparePassword(password);
    
    if (!isValidPassword) {
      console.log(`❌ Password mismatch for: ${email}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log(`✅ Password valid for: ${email}`);
    
    if (user.isSuspended) {
      console.log(`❌ User suspended: ${email}`);
      return res.status(403).json({ error: 'Account suspended' });
    }
    
    if (!user.isActive) {
      console.log(`❌ User inactive: ${email}`);
      return res.status(403).json({ error: 'Account deactivated' });
    }
    
    const authEnhancementDate = new Date('2025-07-26T10:00:00Z');
    const requiresVerification = user.createdAt > authEnhancementDate && !user.isVerified;
    
    if (requiresVerification) {
      return res.status(401).json({ 
        error: 'Please verify your email address before logging in.',
        requiresVerification: true 
      });
    }
    
    let isAdmin = ADMIN_EMAILS.includes(user.email) || user.isAdminPromoted || user.role === 'admin';
    if (isAdmin && user.role !== 'admin') {
      user.role = 'admin';
      await user.save();
    }
    const token = await new Promise((resolve, reject) => {
      jwt.sign({ userId: user._id, isAdmin, role: user.role }, JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
        if (err) reject(err);
        else resolve(token);
      });
    });
    
    res.json({
      message: 'Login successful',
      token,
      user: { 
        id: user._id, 
        email: user.email, 
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin 
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Get Current User ────────────────────────────────────────────
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const isAdmin = user.role === 'admin' || ADMIN_EMAILS.includes(user.email) || user.isAdminPromoted;
    res.json({
      user: { 
        id: user._id, 
        email: user.email, 
        firstName: user.firstName, 
        lastName: user.lastName,
        isAdmin 
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Email Verification ──────────────────────────────────────────
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }
    
    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    
    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    res.status(500).json({ error: 'Email verification failed' });
  }
});

// ── Resend Verification ─────────────────────────────────────────
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    const normalized = email.trim().toLowerCase();
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (!req.app.locals._resendIp) req.app.locals._resendIp = new Map();
    if (!req.app.locals._resendEmail) req.app.locals._resendEmail = new Map();
    const now = Date.now();
    const windowMs = 24 * 60 * 60 * 1000;
    const limit = 5;

    const ipKey = String(ip);
    const emailKey = normalized;

    const prune = (arr) => arr.filter(ts => now - ts < windowMs);

    let ipArr = req.app.locals._resendIp.get(ipKey) || [];
    ipArr = prune(ipArr);
    if (ipArr.length >= limit) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    let emailArr = req.app.locals._resendEmail.get(emailKey) || [];
    emailArr = prune(emailArr);
    if (emailArr.length >= limit) {
      return res.status(429).json({ error: 'Too many requests for this email. Please try again later.' });
    }

    const user = await User.findOne({ email: normalized });

    const generic = { message: 'If an account exists, a verification email has been sent.' };

    if (!user) {
      ipArr.push(now);
      req.app.locals._resendIp.set(ipKey, ipArr);
      emailArr.push(now);
      req.app.locals._resendEmail.set(emailKey, emailArr);
      return res.json(generic);
    }

    if (user.isVerified) {
      ipArr.push(now);
      req.app.locals._resendIp.set(ipKey, ipArr);
      emailArr.push(now);
      req.app.locals._resendEmail.set(emailKey, emailArr);
      return res.json(generic);
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = token;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    try {
      const emailService = require('../services/emailService');
      await emailService.sendEmailVerification(user, token);
    } catch (e) {}

    ipArr.push(now);
    req.app.locals._resendIp.set(ipKey, ipArr);
    emailArr.push(now);
    req.app.locals._resendEmail.set(emailKey, emailArr);

    return res.json(generic);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to send verification email' });
  }
});

// ── Forgot Password ─────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    console.log(`🔄 Password reset request for: ${email}`);
    
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log(`❌ User not found for password reset: ${email}`);
      return res.json({ message: 'If an account exists, a reset email has been sent.' });
    }
    
    console.log(`👤 User found for password reset: ${email}`);
    
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
    await user.save();
    
    console.log(`🔑 Reset token generated for: ${email}`);
    
    try {
      const emailService = require('../services/emailService');
      await emailService.sendPasswordResetEmail(user, resetToken);
      console.log(`📧 Password reset email sent successfully to: ${email}`);
    } catch (emailError) {
      console.error(`❌ Failed to send password reset email to ${email}:`, emailError);
    }
    
    res.json({ message: 'If an account exists, a reset email has been sent.' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Password reset request failed' });
  }
});

// ── Reset Password ──────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// ── Admin Recovery ──────────────────────────────────────────────
router.post('/recover-admin', async (req, res) => {
  try {
    const { email, recoveryKey } = req.body;
    
    if (recoveryKey !== process.env.ADMIN_RECOVERY_KEY) {
      return res.status(401).json({ error: 'Invalid recovery key' });
    }
    
    if (!ADMIN_EMAILS.includes(email)) {
      return res.status(400).json({ error: 'Not an admin email' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'Admin user not found' });
    }
    
    user.isActive = true;
    user.isSuspended = false;
    user.suspensionReason = '';
    await user.save();
    
    console.log(`🔧 Admin account recovered: ${email}`);
    res.json({ message: 'Admin account recovered successfully' });
  } catch (error) {
    console.error('Admin recovery error:', error);
    res.status(500).json({ error: 'Recovery failed' });
  }
});

// ── Google OAuth ────────────────────────────────────────────────
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  async (req, res) => {
    try {
      let isAdmin = ADMIN_EMAILS.includes(req.user.email) || req.user.isAdminPromoted || req.user.role === 'admin';
      if (isAdmin && req.user.role !== 'admin') {
        req.user.role = 'admin';
        await req.user.save();
      }
      const token = jwt.sign({ userId: req.user._id, isAdmin, role: req.user.role }, JWT_SECRET, { expiresIn: '7d' });
      
      res.redirect(`${CLIENT_URL}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: req.user._id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        isAdmin
      }))}`);
    } catch (error) {
      res.redirect(`${CLIENT_URL}/login?error=oauth_failed`);
    }
  }
);

// ── Facebook OAuth ──────────────────────────────────────────────
router.get('/facebook', passport.authenticate('facebook', {
  scope: ['email']
}));

router.get('/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  async (req, res) => {
    try {
      let isAdmin = ADMIN_EMAILS.includes(req.user.email) || req.user.isAdminPromoted || req.user.role === 'admin';
      if (isAdmin && req.user.role !== 'admin') {
        req.user.role = 'admin';
        await req.user.save();
      }
      const token = jwt.sign({ userId: req.user._id, isAdmin, role: req.user.role }, JWT_SECRET, { expiresIn: '7d' });
      
      res.redirect(`${CLIENT_URL}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: req.user._id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        isAdmin
      }))}`);
    } catch (error) {
      res.redirect(`${CLIENT_URL}/login?error=oauth_failed`);
    }
  }
);

module.exports = router;
