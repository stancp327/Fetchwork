const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../middleware/validation');
const { body } = require('express-validator');
const { ADMIN_EMAILS, JWT_SECRET, CLIENT_URL } = require('../config/env');
const { applyReferral } = require('./referrals');
const { trackEvent } = require('../middleware/analytics');
const { emailDomainMiddleware } = require('../middleware/emailValidator');
const { geolocateLogin } = require('../middleware/geolocate');

const recoverAdminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many recovery attempts. Try again in 1 hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Short-lived OAuth code store - prevents JWT from leaking into redirect URLs
// Codes expire after 60s and are single-use
const oauthCodeStore = new Map();
function createOAuthCode(payload) {
  const code = crypto.randomBytes(32).toString('hex');
  oauthCodeStore.set(code, { payload, expiresAt: Date.now() + 60_000 });
  // Clean up expired codes periodically
  if (oauthCodeStore.size > 500) {
    const now = Date.now();
    for (const [k, v] of oauthCodeStore) {
      if (v.expiresAt < now) oauthCodeStore.delete(k);
    }
  }
  return code;
}
function consumeOAuthCode(code) {
  const entry = oauthCodeStore.get(code);
  if (!entry) return null;
  oauthCodeStore.delete(code); // single-use
  if (entry.expiresAt < Date.now()) return null;
  return entry.payload;
}
const { assignDefaultPlan } = require('../utils/billingUtils');
const { canonicalizeEmail } = require('../utils/authIdentity');

// ── Register ────────────────────────────────────────────────────
router.post('/register', validateRegister, emailDomainMiddleware, async (req, res) => {
  try {
    const { email, password, firstName, lastName, accountType, ref } = req.body;
    const emailCanonical = canonicalizeEmail(email);

    const existingUser = await User.findOne({ emailCanonical });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const user = new User({
      email: emailCanonical,
      emailCanonical,
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

    // Assign default (free) billing plan - non-fatal if plans not seeded yet
    const planAudience = (accountType === 'client') ? 'client' : 'freelancer';
    assignDefaultPlan(user._id, planAudience).catch(() => {});

    // Apply referral if signup came via a ref link - fire-and-forget
    if (ref) applyReferral(String(user._id), ref).catch(() => {});

    try {
      const emailService = require('../services/emailService');
      const emailWorkflowService = require('../services/emailWorkflowService');
      const emailResult = await emailService.sendEmailVerification(user, user.emailVerificationToken);
      if (!emailResult.success) {
        console.error(`❌ Verification email FAILED for ${user.email}:`, emailResult.error);
      }
      setTimeout(() => emailWorkflowService.sendOnboardingSequence(user._id), 60000);
    } catch (emailError) {
      console.error(`❌ Verification email EXCEPTION for ${user.email}:`, emailError.message);
    }

    trackEvent('signups');
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
    const emailCanonical = canonicalizeEmail(email);
    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) console.log(`🔐 Login attempt for: ${emailCanonical}`);

    const user = await User.findOne({ emailCanonical });

    if (!user) {
      if (isDev) console.log(`❌ User not found: ${email}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await user.comparePassword(password);

    if (!isValidPassword) {
      if (isDev) console.log(`❌ Password mismatch for: ${email}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.isSuspended) {
      return res.status(403).json({ error: 'Account suspended' });
    }

    if (!user.isActive) {
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
      await User.updateOne({ _id: user._id }, { $set: { role: 'admin' } });
      user.role = 'admin';
    }
    const token = await new Promise((resolve, reject) => {
      jwt.sign({ userId: user._id, isAdmin, role: user.role, tokenVersion: user.tokenVersion || 0 }, JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
        if (err) reject(err);
        else resolve(token);
      });
    });

    // Track login location (non-blocking - don't await, don't fail login on error)
    geolocateLogin(user, req).then(geoResult => {
      if (geoResult) {
        user.save().catch(() => {}); // persist lastLoginIp/Country/City
        if (geoResult.isNewCountry) {
          console.log(`[geo] New country login: ${user.email} from ${geoResult.geo.countryCode} (was ${geoResult.previousCountry})`);
          // TODO: send new-location alert email when email system is stable
        }
        if (geoResult.isSuspiciousIp) {
          console.warn(`[geo] Suspicious IP login: ${user.email} from ${geoResult.geo.ip} (proxy/hosting)`);
        }
      }
    }).catch(() => {});

    trackEvent('successfulLogins');
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
// GET /api/auth/me/features - return all feature flags for the current user
// Used by frontend to conditionally show/hide premium UI elements
router.get('/me/features', authenticateToken, async (req, res) => {
  try {
    const { getUserFeatures } = require('../services/entitlementEngine');
    const features = await getUserFeatures(req.user.userId || req.user._id);
    res.json({ features });
  } catch (err) {
    console.error('Error getting user features:', err.message);
    res.status(500).json({ error: 'Failed to fetch feature flags' });
  }
});

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

    await User.updateOne({ _id: user._id }, {
      $set: { isVerified: true, isEmailVerified: true, verificationLevel: 'email' },
      $unset: { emailVerificationToken: '', emailVerificationExpires: '' },
      $addToSet: { badges: 'email_verified' }
    });

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
    const normalized = canonicalizeEmail(email);
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

    const user = await User.findOne({ emailCanonical: normalized });

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
      const result = await emailService.sendEmailVerification(user, token);
      if (!result.success) {
        console.error(`❌ Resend verification email FAILED for ${user.email}:`, result.error);
      }
    } catch (e) {
      console.error(`❌ Resend verification email EXCEPTION for ${user.email}:`, e.message);
    }

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
    const emailCanonical = canonicalizeEmail(email);
    console.log(`🔄 Password reset request for: ${emailCanonical}`);

    const user = await User.findOne({ emailCanonical });

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
router.post('/reset-password', [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  (req, res, next) => {
    const { validationResult } = require('express-validator');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    next();
  }
], async (req, res) => {
  try {
    const { token, password } = req.body;
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Use model save() to go through pre-save hook (14 bcrypt rounds) - fixes H5
    // Increment tokenVersion to invalidate all existing JWTs - fixes H2
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// ── Admin Recovery ──────────────────────────────────────────────
router.post('/recover-admin', recoverAdminLimiter, async (req, res) => {
  try {
    const { email, recoveryKey } = req.body;
    const emailCanonical = canonicalizeEmail(email);

    if (recoveryKey !== process.env.ADMIN_RECOVERY_KEY) {
      return res.status(401).json({ error: 'Invalid recovery key' });
    }

    if (!ADMIN_EMAILS.includes(emailCanonical)) {
      return res.status(400).json({ error: 'Not an admin email' });
    }

    const user = await User.findOne({ emailCanonical });
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
      const User = require('../models/User');
      let isAdmin = ADMIN_EMAILS.includes(req.user.email) || req.user.isAdminPromoted || req.user.role === 'admin';
      if (isAdmin && req.user.role !== 'admin') {
        await User.updateOne({ _id: req.user._id }, { $set: { role: 'admin' } });
        req.user.role = 'admin';
      }
      const token = jwt.sign({ userId: req.user._id, isAdmin, role: req.user.role, tokenVersion: req.user.tokenVersion || 0 }, JWT_SECRET, { expiresIn: '7d' });
      const code = createOAuthCode({
        token,
        user: { id: req.user._id, email: req.user.email, firstName: req.user.firstName, lastName: req.user.lastName, isAdmin }
      });
      // Redirect with a short-lived code only - token never appears in URL
      // Check if already on callback path to avoid unnecessary redirect
      if (req.headers.referer && req.headers.referer.includes('/auth/callback')) {
        res.json({ success: true, code });
      } else {
        res.redirect(`${CLIENT_URL}/auth/callback?code=${code}`);
      }
    } catch (error) {
      // Avoid redirect if already on login with error
      if (req.headers.referer && req.headers.referer.includes('/login')) {
        res.json({ success: false, error: 'oauth_failed' });
      } else {
        res.redirect(`${CLIENT_URL}/login?error=oauth_failed`);
      }
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
      const User = require('../models/User');
      let isAdmin = ADMIN_EMAILS.includes(req.user.email) || req.user.isAdminPromoted || req.user.role === 'admin';
      if (isAdmin && req.user.role !== 'admin') {
        await User.updateOne({ _id: req.user._id }, { $set: { role: 'admin' } });
        req.user.role = 'admin';
      }
      const token = jwt.sign({ userId: req.user._id, isAdmin, role: req.user.role, tokenVersion: req.user.tokenVersion || 0 }, JWT_SECRET, { expiresIn: '7d' });
      const code = createOAuthCode({
        token,
        user: { id: req.user._id, email: req.user.email, firstName: req.user.firstName, lastName: req.user.lastName, isAdmin }
      });
      // Redirect with a short-lived code only — token never appears in URL
      // Check if already on callback path to avoid unnecessary redirect
      if (req.headers.referer && req.headers.referer.includes('/auth/callback')) {
        res.json({ success: true, code });
      } else {
        res.redirect(`${CLIENT_URL}/auth/callback?code=${code}`);
      }
    } catch (error) {
      // Avoid redirect if already on login with error
      if (req.headers.referer && req.headers.referer.includes('/login')) {
        res.json({ success: false, error: 'oauth_failed' });
      } else {
        res.redirect(`${CLIENT_URL}/login?error=oauth_failed`);
      }
    }
  }
);

// ── GET /api/auth/oauth/exchange - exchange short-lived OAuth code for JWT ──
// Frontend calls this immediately on /auth/callback arrival
router.get('/oauth/exchange', (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing code' });
  const payload = consumeOAuthCode(code);
  if (!payload) return res.status(400).json({ error: 'Invalid or expired code' });
  return res.json(payload); // { token, user }
});

// ── POST /api/auth/refresh - exchange valid token for a new one ──
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.userId).select('tokenVersion role isAdmin email');
    if (!user) return res.status(401).json({ error: 'User not found' });
    const isAdmin = ADMIN_EMAILS.includes(user.email) || user.isAdminPromoted || user.role === 'admin';
    const token = jwt.sign(
      { userId: user._id, isAdmin, role: user.role, tokenVersion: user.tokenVersion || 0 },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token });
  } catch (err) {
    console.error('Token refresh error:', err);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// ── POST /api/auth/logout - invalidate all sessions ─────────────
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.user._id || req.user.userId,
      { $inc: { tokenVersion: 1 } }
    );
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    // Still return success - client should clear token regardless
    res.json({ message: 'Logged out' });
  }
});

// ── POST /api/auth/google/mobile - Google ID token for Expo ─────
router.post('/google/mobile', async (req, res) => {
  try {
    const { idToken, accessToken } = req.body;
    if (!idToken && !accessToken) return res.status(400).json({ error: 'idToken or accessToken required' });

    let email, given_name, family_name, picture, googleId, email_verified;

    if (idToken) {
      // Verify ID token (preferred - available when webClientId is set)
      const { OAuth2Client } = require('google-auth-library');
      const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
      const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
      const payload = ticket.getPayload();
      ({ email, given_name, family_name, picture, sub: googleId, email_verified } = payload);
    } else {
      // Fallback: exchange accessToken for user info (Android-only flow)
      const resp = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`);
      if (!resp.ok) return res.status(401).json({ error: 'Invalid Google access token' });
      const info = await resp.json();
      ({ email, given_name, family_name, picture, sub: googleId, email_verified } = info);
    }

    const emailCanonical = canonicalizeEmail(email);
    if (!emailCanonical) return res.status(400).json({ error: 'Google account did not return an email' });
    if (email_verified === false) return res.status(403).json({ error: 'Google email is not verified' });

    let user = await User.findOne({ googleId });

    if (!user) {
      try {
        user = await User.findOneAndUpdate(
          { emailCanonical },
          {
            $set: {
              googleId,
              email: emailCanonical,
              emailCanonical,
              profilePicture: picture || '',
              isEmailVerified: true,
              isVerified: true,
              verificationLevel: 'email',
              lastLogin: new Date(),
            },
            $setOnInsert: {
              firstName: given_name || '',
              lastName: family_name || '',
              role: 'freelancer',
              tokenVersion: 0,
            },
            $addToSet: {
              providers: 'google',
              badges: 'email_verified',
            },
          },
          { upsert: true, new: true }
        );
      } catch (e) {
        if (e?.code === 11000) {
          user = await User.findOne({ $or: [{ googleId }, { emailCanonical }] });
        } else {
          throw e;
        }
      }
    }

    const isAdmin = ADMIN_EMAILS.includes(user.email) || user.isAdminPromoted || user.role === 'admin';
    const token = jwt.sign(
      { userId: user._id, isAdmin, role: user.role, tokenVersion: user.tokenVersion || 0 },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        profilePicture: user.profilePicture,
      }
    });
  } catch (err) {
    console.error('Google mobile auth error:', err);
    res.status(401).json({ error: 'Google authentication failed' });
  }
});

module.exports = router;

