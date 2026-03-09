/**
 * Team Channels — group messaging rooms scoped to a team.
 * Wraps the existing ChatRoom/Message infrastructure.
 */
const express = require('express');
const router  = express.Router();
const mongoose = require('mongoose');
const { authenticateToken } = require('../middleware/auth');
const Message  = require('../models/Message');
const Team     = require('../models/Team');

router.use(authenticateToken);

// Helper — verify user is an active team member, return member record
async function requireTeamMember(teamId, userId) {
  const team = await Team.findById(teamId).lean();
  if (!team) throw Object.assign(new Error('Team not found'), { status: 404 });
  const member = team.members.find(
    m => m.user.toString() === userId.toString() && m.status === 'active'
  );
  if (!member) throw Object.assign(new Error('Not a team member'), { status: 403 });
  return { team, member };
}

// ChatRoom is registered by Message.js — look it up after that module loads
function getChatRoom() {
  try { return mongoose.model('ChatRoom'); } catch { return null; }
}

// ── GET /api/team-channels/:teamId ─────────────────────────────
// List all channels for a team the user belongs to
router.get('/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user._id || req.user.userId;
    await requireTeamMember(teamId, userId);

    const ChatRoom = getChatRoom();
    if (!ChatRoom) return res.status(503).json({ error: 'Chat service unavailable' });

    const rooms = await ChatRoom.find({
      'members.user': userId,
      isActive: true,
      $or: [{ teamId }, { name: { $regex: `^\\[${teamId}\\]` } }],
    })
      .populate('members.user', 'firstName lastName avatar')
      .populate('createdBy', 'firstName lastName')
      .sort({ lastActivity: -1 })
      .lean();

    res.json({ channels: rooms });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// ── POST /api/team-channels ────────────────────────────────────
// Create a new team channel
router.post('/', async (req, res) => {
  try {
    const { teamId, name, description, memberIds = [] } = req.body;
    if (!teamId || !name?.trim()) return res.status(400).json({ error: 'teamId and name required' });

    const userId = req.user._id || req.user.userId;
    const { team } = await requireTeamMember(teamId, userId);

    const ChatRoom = getChatRoom();
    if (!ChatRoom) return res.status(503).json({ error: 'Chat service unavailable' });

    // Build member list — creator + requested members (all must be team members)
    const activeTeamMemberIds = team.members
      .filter(m => m.status === 'active')
      .map(m => m.user.toString());

    const validMemberIds = [...new Set([userId.toString(), ...memberIds])]
      .filter(id => activeTeamMemberIds.includes(id));

    const members = validMemberIds.map(id => ({
      user: id,
      role: id === userId.toString() ? 'admin' : 'member',
    }));

    const room = await ChatRoom.create({
      name: name.trim(),
      description: description?.trim() || '',
      type: 'group',
      createdBy: userId,
      members,
      isActive: true,
      teamId, // store for filtering
    });

    await room.populate('members.user', 'firstName lastName avatar');
    res.status(201).json({ channel: room });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// ── POST /api/team-channels/:channelId/members ─────────────────
// Add a team member to a channel
router.post('/:channelId/members', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { memberId, teamId } = req.body;
    if (!memberId || !teamId) return res.status(400).json({ error: 'memberId and teamId required' });

    const userId = req.user._id || req.user.userId;
    const { team } = await requireTeamMember(teamId, userId);

    // Verify the person being added is also a team member
    const isTeamMember = team.members.some(
      m => m.user.toString() === memberId && m.status === 'active'
    );
    if (!isTeamMember) return res.status(400).json({ error: 'User is not a team member' });

    const ChatRoom = getChatRoom();
    const room = await ChatRoom.findByIdAndUpdate(
      channelId,
      { $addToSet: { members: { user: memberId, role: 'member' } } },
      { new: true }
    ).populate('members.user', 'firstName lastName avatar');

    if (!room) return res.status(404).json({ error: 'Channel not found' });
    res.json({ channel: room });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// ── GET /api/team-channels/:channelId/messages ─────────────────
// Get message history for a channel
router.get('/:channelId/messages', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { before, limit: rawLimit = 50 } = req.query;
    const limit = Math.min(Math.max(1, Number(rawLimit) || 50), 200); // cap at 200
    const userId = req.user._id || req.user.userId;

    const ChatRoom = getChatRoom();
    const room = await ChatRoom.findById(channelId).lean();
    if (!room) return res.status(404).json({ error: 'Channel not found' });

    const isMember = room.members.some(m => m.user.toString() === userId.toString());
    if (!isMember) return res.status(403).json({ error: 'Not a channel member' });

    const query = { roomId: channelId };
    if (before) query._id = { $lt: before };

    const Msg = (() => { try { return mongoose.model('Message'); } catch { return null; } })();
    const msgs = Msg
      ? await Msg.find(query)
          .populate('sender', 'firstName lastName avatar')
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean()
      : [];

    res.json({ messages: msgs.reverse(), hasMore: msgs.length === Number(limit) });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// ── POST /api/team-channels/:channelId/messages ────────────────
// Send a message to a channel
router.post('/:channelId/messages', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'content required' });
    if (content.length > 10000) return res.status(400).json({ error: 'Message too long (max 10,000 characters)' });

    const userId = req.user._id || req.user.userId;
    const ChatRoom = getChatRoom();
    const room = await ChatRoom.findById(channelId).lean();
    if (!room) return res.status(404).json({ error: 'Channel not found' });

    const isMember = room.members.some(m => m.user.toString() === userId.toString());
    if (!isMember) return res.status(403).json({ error: 'Not a channel member' });

    const Msg = (() => { try { return mongoose.model('Message'); } catch { return null; } })();
    if (!Msg) return res.status(503).json({ error: 'Message service unavailable' });

    const msg = await Msg.create({
      roomId: channelId,
      sender: userId,
      content: content.trim(),
      messageType: 'text',
    });

    // Update room lastActivity
    await ChatRoom.findByIdAndUpdate(channelId, { lastActivity: new Date() });

    await msg.populate('sender', 'firstName lastName avatar');
    res.status(201).json({ message: msg });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

module.exports = router;
