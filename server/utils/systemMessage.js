/**
 * System message helper — sends in-app messages from "Fetchwork Moderator"
 * Uses a special system user account. Creates it on first use.
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const { Message, Conversation } = require('../models/Message');

const SYSTEM_EMAIL = 'system@fetchwork.com';
let _systemUser = null;

/**
 * Get or create the system moderator user.
 */
async function getSystemUser() {
  if (_systemUser) return _systemUser;

  _systemUser = await User.findOne({ email: SYSTEM_EMAIL }).lean();
  if (_systemUser) return _systemUser;

  // Create the system user (won't appear in normal user lists due to role)
  const user = new User({
    firstName: 'Fetchwork',
    lastName: 'Moderator',
    email: SYSTEM_EMAIL,
    username: 'moderator',
    password: require('crypto').randomBytes(32).toString('hex'), // random, unused
    role: 'admin',
    isAdmin: true,
    profilePicture: '', // could set a moderator avatar later
  });
  await user.save();
  _systemUser = user.toObject();
  console.log('[systemMessage] Created system moderator user:', _systemUser._id);
  return _systemUser;
}

/**
 * Send a system/moderator message to a user.
 * Creates or reuses a conversation between the moderator and the target user.
 * 
 * @param {string} targetUserId - The user to message
 * @param {string} content - Message text
 * @param {object} [options] - Optional metadata
 * @param {string} [options.action] - e.g. 'job_cancelled', 'service_suspended'
 * @param {object} [options.metadata] - Extra metadata to attach
 */
async function sendModeratorMessage(targetUserId, content, options = {}) {
  try {
    const systemUser = await getSystemUser();
    const systemId = systemUser._id;
    const targetId = new mongoose.Types.ObjectId(targetUserId);

    // Find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [systemId, targetId] },
      type: 'direct',
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [systemId, targetId],
        type: 'direct',
      });
    }

    // Create the message
    const message = await Message.create({
      conversation: conversation._id,
      sender: systemId,
      recipient: targetId,
      content,
      messageType: 'system',
      metadata: {
        type: 'admin_action',
        action: options.action || 'moderator_message',
        ...(options.metadata || {}),
      },
    });

    // Update conversation last message
    conversation.lastMessage = message._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    return message;
  } catch (err) {
    console.error('[systemMessage] Failed to send moderator message:', err.message);
    // Non-fatal — don't break the admin action
    return null;
  }
}

module.exports = { sendModeratorMessage, getSystemUser };
