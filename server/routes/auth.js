const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const FraudReport = require('../models/FraudReport');
const auth = require('../middleware/auth');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  if (password.length < minLength) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!hasUpperCase) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!hasLowerCase) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!hasNumbers) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  if (!hasSpecialChar) {
    return { valid: false, message: 'Password must contain at least one special character' };
  }
  
  return { valid: true };
};

const sendVerificationEmail = async (user, token) => {
  console.log(`Mock email sent to ${user.email} with verification token: ${token}`);
  return true;
};

const sendSMS = async (phoneNumber, message) => {
  console.log(`Mock SMS sent to ${phoneNumber}: ${message}`);
  return true;
};

router.post('/register', async (req, res) => {
  try {
    const { email, password, userType, firstName, lastName, phoneNumber } = req.body;
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = new User({
      email,
      password,
      userType,
      phoneNumber,
      profile: { firstName, lastName }
    });

    const emailToken = user.generateEmailVerificationToken();
    await user.save();

    await sendVerificationEmail(user, emailToken);

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User created successfully. Please check your email for verification.',
      token,
      user: {
        id: user._id,
        email: user.email,
        userType: user.userType,
        profile: user.profile,
        isEmailVerified: user.isEmailVerified,
        verificationLevel: user.verificationLevel
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (user.isLocked) {
      return res.status(423).json({ 
        message: 'Account temporarily locked due to too many failed login attempts. Please try again later.' 
      });
    }

    if (user.isSuspended) {
      return res.status(403).json({ 
        message: 'Account suspended. Please contact support.',
        reason: user.suspensionReason 
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incLoginAttempts();
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    await user.resetLoginAttempts();
    await user.recordLogin(ip, userAgent);

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        userType: user.userType,
        profile: user.profile,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        verificationLevel: user.verificationLevel,
        twoFactorEnabled: user.twoFactorEnabled
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }
    
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    
    await user.save();
    
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/resend-verification', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (user.isEmailVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }
    
    const emailToken = user.generateEmailVerificationToken();
    await user.save();
    
    await sendVerificationEmail(user, emailToken);
    
    res.json({ message: 'Verification email sent' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/send-phone-verification', auth, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const user = await User.findById(req.user.userId);
    
    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required' });
    }
    
    user.phoneNumber = phoneNumber;
    const phoneToken = user.generatePhoneVerificationToken();
    await user.save();
    
    await sendSMS(phoneNumber, `Your FetchWork verification code is: ${phoneToken}`);
    
    res.json({ message: 'Verification code sent to your phone' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/verify-phone', auth, async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.user.userId);
    
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    if (user.phoneVerificationToken !== hashedToken || user.phoneVerificationExpires < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }
    
    user.isPhoneVerified = true;
    user.phoneVerificationToken = undefined;
    user.phoneVerificationExpires = undefined;
    
    await user.save();
    
    res.json({ message: 'Phone number verified successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const resetToken = user.generatePasswordResetToken();
    await user.save();
    
    console.log(`Mock password reset email sent to ${email} with token: ${resetToken}`);
    
    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }
    
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }
    
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    
    await user.save();
    
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/report-fraud', auth, async (req, res) => {
  try {
    const { reportedUserId, reportType, description, evidence, relatedJob, relatedMessage, relatedPayment } = req.body;
    
    if (!reportedUserId || !reportType || !description) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    const reportedUser = await User.findById(reportedUserId);
    if (!reportedUser) {
      return res.status(404).json({ message: 'Reported user not found' });
    }
    
    if (reportedUserId === req.user.userId) {
      return res.status(400).json({ message: 'Cannot report yourself' });
    }
    
    const existingReport = await FraudReport.findOne({
      reportedUser: reportedUserId,
      reportedBy: req.user.userId,
      status: { $in: ['pending', 'under_review'] }
    });
    
    if (existingReport) {
      return res.status(400).json({ message: 'You have already reported this user' });
    }
    
    const fraudReport = new FraudReport({
      reportedUser: reportedUserId,
      reportedBy: req.user.userId,
      reportType,
      description,
      evidence,
      relatedJob,
      relatedMessage,
      relatedPayment
    });
    
    await fraudReport.save();
    await reportedUser.addSecurityFlag(reportType, description, req.user.userId);
    
    res.status(201).json({ 
      message: 'Report submitted successfully',
      reportId: fraudReport._id 
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/security-status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    res.json({
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      verificationLevel: user.verificationLevel,
      twoFactorEnabled: user.twoFactorEnabled,
      hasPhoneNumber: !!user.phoneNumber,
      lastLogin: user.lastLogin,
      loginAttempts: user.loginAttempts,
      isLocked: user.isLocked
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/switch-role', auth, async (req, res) => {
  try {
    const { newUserType } = req.body;
    
    if (!['client', 'freelancer'].includes(newUserType)) {
      return res.status(400).json({ message: 'Invalid user type' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.userType = newUserType;
    await user.save();

    res.json({
      message: 'User type switched successfully',
      user: {
        id: user._id,
        email: user.email,
        userType: user.userType,
        profile: user.profile
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
