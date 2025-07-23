const express = require('express');
const router = express.Router();
const { Message, ChatRoom } = require('../models/Message');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const rooms = await ChatRoom.find({
      'members.user': req.user._id,
      isActive: true
    })
    .populate('members.user', 'firstName lastName profilePicture')
    .populate('createdBy', 'firstName lastName profilePicture')
    .populate('job', 'title')
    .sort({ lastActivity: -1 });
    
    res.json({ chatrooms: rooms });
  } catch (error) {
    console.error('Error fetching chatrooms:', error);
    res.status(500).json({ error: 'Failed to fetch chatrooms' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, members, jobId, isPrivate = false } = req.body;
    
    if (!name || !members || !Array.isArray(members)) {
      return res.status(400).json({ error: 'Room name and members array are required' });
    }
    
    const uniqueMembers = [...new Set([...members, req.user._id.toString()])];
    
    if (uniqueMembers.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 members allowed per room' });
    }
    
    const memberObjects = uniqueMembers.map(userId => ({
      user: userId,
      role: userId === req.user._id.toString() ? 'admin' : 'member'
    }));
    
    const room = new ChatRoom({
      name,
      description,
      type: 'group',
      members: memberObjects,
      createdBy: req.user._id,
      job: jobId || null,
      isPrivate
    });
    
    await room.save();
    
    const populatedRoom = await ChatRoom.findById(room._id)
      .populate('members.user', 'firstName lastName profilePicture')
      .populate('createdBy', 'firstName lastName profilePicture');
    
    res.status(201).json({
      message: 'Chatroom created successfully',
      chatroom: populatedRoom
    });
  } catch (error) {
    console.error('Error creating chatroom:', error);
    res.status(500).json({ error: 'Failed to create chatroom' });
  }
});

router.get('/:roomId', authenticateToken, async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId)
      .populate('members.user', 'firstName lastName profilePicture')
      .populate('createdBy', 'firstName lastName profilePicture');
    
    if (!room || !room.isMember(req.user._id)) {
      return res.status(404).json({ error: 'Chatroom not found or access denied' });
    }
    
    res.json({ chatroom: room });
  } catch (error) {
    console.error('Error fetching chatroom:', error);
    res.status(500).json({ error: 'Failed to fetch chatroom' });
  }
});

router.get('/:roomId/messages', authenticateToken, async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId);
    
    if (!room || !room.isMember(req.user._id)) {
      return res.status(404).json({ error: 'Chatroom not found or access denied' });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    const messages = await Message.find({
      roomId: req.params.roomId,
      isDeleted: false
    })
    .populate('sender', 'firstName lastName profilePicture')
    .populate('mentions', 'firstName lastName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
    
    const total = await Message.countDocuments({
      roomId: req.params.roomId,
      isDeleted: false
    });
    
    const unreadMessageIds = messages
      .filter(msg => !msg.readBy.some(r => r.user.toString() === req.user._id.toString()))
      .map(msg => msg._id);
    
    if (unreadMessageIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: unreadMessageIds } },
        { $addToSet: { readBy: { user: req.user._id } } }
      );
    }
    
    res.json({
      chatroom: room,
      messages: messages.reverse(),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching chatroom messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/:roomId/members', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const room = await ChatRoom.findById(req.params.roomId);
    
    if (!room) {
      return res.status(404).json({ error: 'Chatroom not found' });
    }
    
    const userRole = room.getMemberRole(req.user._id);
    if (!userRole || (userRole !== 'admin' && userRole !== 'moderator')) {
      return res.status(403).json({ error: 'Insufficient permissions to add members' });
    }
    
    await room.addMember(userId);
    
    const updatedRoom = await ChatRoom.findById(room._id)
      .populate('members.user', 'firstName lastName profilePicture');
    
    res.json({
      message: 'Member added successfully',
      chatroom: updatedRoom
    });
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

router.delete('/:roomId/members/:userId', authenticateToken, async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId);
    
    if (!room) {
      return res.status(404).json({ error: 'Chatroom not found' });
    }
    
    const userRole = room.getMemberRole(req.user._id);
    const isRemovingSelf = req.params.userId === req.user._id.toString();
    
    if (!isRemovingSelf && (!userRole || (userRole !== 'admin' && userRole !== 'moderator'))) {
      return res.status(403).json({ error: 'Insufficient permissions to remove members' });
    }
    
    await room.removeMember(req.params.userId);
    
    const updatedRoom = await ChatRoom.findById(room._id)
      .populate('members.user', 'firstName lastName profilePicture');
    
    res.json({
      message: 'Member removed successfully',
      chatroom: updatedRoom
    });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

module.exports = router;
