const express    = require('express');
const router     = express.Router();
const crypto     = require('crypto');
const User       = require('../models/User');
const Referral   = require('../models/Referral');
const { notify } = require('../services/notificationService');
const { authenticateToken } = require('../middleware/auth');

const REWARD_AMOUNT = 25; // $25 credit per qualified referral
const BASE_URL      = process.env.CLIENT_URL || 'https://fetchwork.net';

// ── Helper: generate a short unique code ─────────────────────────
function genCode() {
  return crypto.randomBytes(4).toString('hex'); // 8-char hex e.g. "a3f92b1c"
}

// ── Ensure user has a referral code (lazy-generate) ──────────────
async function ensureCode(userId) {
  const user = await User.findById(userId).select('referralCode firstName lastName');
  if (user.referralCode) return user.referralCode;

  // Try name-based code first, fallback to random
  const base = `${(user.firstName || '').toLowerCase().replace(/[^a-z]/g, '')}`;
  let code = base.slice(0, 8) + Math.floor(Math.random() * 100);
  const exists = await User.findOne({ referralCode: code }).lean();
  if (exists || !base) code = genCode();

  await User.updateOne({ _id: userId }, { referralCode: code });
  return code;
}

// ── GET /api/referrals/me ─────────────────────────────────────────
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const code = await ensureCode(req.user.userId);
    const user = await User.findById(req.user.userId).select('referralCredits').lean();

    const referrals = await Referral.find({ referrer: req.user.userId })
      .populate('referee', 'firstName lastName createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const stats = {
      code,
      link:        `${BASE_URL}?ref=${code}`,
      credits:     user.referralCredits || 0,
      total:       referrals.length,
      pending:     referrals.filter(r => r.status === 'pending').length,
      qualified:   referrals.filter(r => r.status === 'qualified').length,
      rewarded:    referrals.filter(r => r.status === 'rewarded').length,
      rewardAmount: REWARD_AMOUNT,
      referrals:   referrals.map(r => ({
        id:        r._id,
        name:      `${r.referee?.firstName || ''} ${r.referee?.lastName || ''}`.trim() || 'Anonymous',
        status:    r.status,
        joinedAt:  r.referee?.createdAt,
        rewardedAt: r.rewardedAt,
      })),
    };

    res.json(stats);
  } catch (err) {
    console.error('Referral stats error:', err);
    res.status(500).json({ error: 'Failed to load referral data' });
  }
});

// ── POST /api/referrals/apply — called from auth register ────────
// Body: { referralCode, refereeId }
// Called server-side from auth route after new user created
async function applyReferral(refereeId, code) {
  try {
    if (!code) return;
    const referrer = await User.findOne({ referralCode: code }).select('_id').lean();
    if (!referrer) return;
    if (String(referrer._id) === String(refereeId)) return; // can't refer yourself

    // Idempotent — unique index on referee prevents duplicates
    await Referral.create({
      referrer:     referrer._id,
      referee:      refereeId,
      code,
      status:       'pending',
      rewardAmount: REWARD_AMOUNT,
    });
  } catch (err) {
    if (err.code !== 11000) console.error('applyReferral error:', err.message);
    // Duplicate (11000) = already referred, silent ignore
  }
}

// ── triggerReferralReward — call when referee completes first job ─
async function triggerReferralReward(refereeId) {
  try {
    const referral = await Referral.findOne({ referee: refereeId, status: 'pending' });
    if (!referral) return;

    // Mark qualified first
    referral.status = 'qualified';
    await referral.save();

    // Add credit to referrer's wallet
    await User.updateOne(
      { _id: referral.referrer },
      { $inc: { referralCredits: referral.rewardAmount } }
    );

    referral.status    = 'rewarded';
    referral.rewardedAt = new Date();
    await referral.save();

    // Notify referrer
    const referee = await User.findById(refereeId).select('firstName lastName').lean();
    const name    = `${referee?.firstName || ''} ${referee?.lastName || ''}`.trim() || 'Someone';
    await notify({
      recipient: referral.referrer,
      type:      'referral_reward',
      title:     'Referral reward earned!',
      message:   `🎁 ${name} completed their first job! You earned $${referral.rewardAmount} in referral credits.`,
      link:      `/referrals`,
    });
  } catch (err) {
    console.error('triggerReferralReward error:', err.message);
  }
}

module.exports = router;
module.exports.applyReferral        = applyReferral;
module.exports.triggerReferralReward = triggerReferralReward;
