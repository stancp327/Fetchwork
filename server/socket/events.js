const { Message, Conversation, ChatRoom } = require('../models/Message');
const User = require('../models/User');
const Call = require('../models/Call');

const activeUsers = new Map(); // userId -> Set of socketIds
const socketToUser = new Map(); // socketId -> userId

module.exports = (io) => {
  io.on('connection', (socket) => {
    const senderId = socket.user.userId;
    console.log(`🔌 User connected: ${senderId}`);

    // Lightweight per-socket rate limiter (anti-spam / abuse control)
    const rateBuckets = new Map();
    const consumeRate = (key, limit, windowMs) => {
      const now = Date.now();
      const bucket = rateBuckets.get(key) || { count: 0, resetAt: now + windowMs };
      if (now > bucket.resetAt) {
        bucket.count = 0;
        bucket.resetAt = now + windowMs;
      }
      bucket.count += 1;
      rateBuckets.set(key, bucket);
      return bucket.count <= limit;
    };
    
    socket.join(senderId);
    
    socketToUser.set(socket.id, senderId);
    
    if (!activeUsers.has(senderId)) {
      activeUsers.set(senderId, new Set());
      socket.broadcast.emit('user:online', { userId: senderId });
    }
    activeUsers.get(senderId).add(socket.id);
    
    rejoinUserRooms(socket, senderId);

    socket.on('message:send', async (data) => {
      if (!consumeRate('message:send', 30, 10_000)) {
        socket.emit('error', { message: 'Rate limit exceeded for sending messages' });
        return;
      }

      const { recipientId, roomId, content, messageType = 'text', attachments = [], jobId, mentions = [] } = data || {};
      if (typeof content !== 'string' || !content.trim()) {
        socket.emit('error', { message: 'Message content is required' });
        return;
      }

      try {
        if (roomId) {
          if (!content) {
            socket.emit('error', { message: 'Message content is required' });
            return;
          }

          const room = await ChatRoom.findById(roomId);
          if (!room || !room.isMember(senderId)) {
            socket.emit('error', { message: 'Room not found or access denied' });
            return;
          }

          const newMessage = await Message.create({
            roomId,
            sender: senderId,
            content,
            messageType,
            attachments,
            mentions
          });

          await room.updateLastActivity();
          await newMessage.populate('sender', 'firstName lastName profilePicture');
          await newMessage.populate('mentions', 'firstName lastName');

          const onlineMembers = room.members.filter(member => 
            member.user && activeUsers.has(member.user.toString()) && member.user.toString() !== senderId
          );

          for (const member of onlineMembers) {
            await newMessage.markAsDelivered(member.user);
          }

          const messageWithId = {
            ...newMessage.toObject(),
            _id: newMessage._id.toString(),
            roomId: newMessage.roomId.toString()
          };

          socket.to(roomId).emit('message:receive', { message: messageWithId });

          if (onlineMembers.length > 0) {
            socket.emit('message:delivered', {
              messageId: newMessage._id.toString(),
              deliveredTo: onlineMembers.map(m => m.user.toString()),
              deliveredAt: new Date()
            });
          }


        } else {
          if (!recipientId || !content) {
            socket.emit('error', { message: 'Recipient and message content are required' });
            return;
          }

          if (recipientId === senderId) {
            socket.emit('error', { message: 'Cannot send message to yourself' });
            return;
          }

          let conversation = await Conversation.findByParticipants(senderId, recipientId);
          
          if (!conversation) {
            conversation = new Conversation({
              participants: [senderId, recipientId],
              job: jobId || null
            });
            await conversation.save();
          }

          const newMessage = await Message.create({
            conversation: conversation._id,
            sender: senderId,
            recipient: recipientId,
            content,
            messageType,
            attachments,
            isRead: false
          });

          conversation.lastMessage = newMessage._id;
          await conversation.updateLastActivity();

          // ── Avg response time (EMA, fully async fire-and-forget) ────
          // Runs off the hot path so message:send isn't blocked by extra DB queries
          setImmediate(async () => {
            try {
              const senderMsgCount = await Message.countDocuments({
                conversation: conversation._id,
                sender: senderId,
                messageType: 'text'
              });
              if (senderMsgCount !== 1) return; // only on first reply

              const opener = await Message.findOne({
                conversation: conversation._id,
                sender: { $ne: senderId },
                messageType: 'text'
              }).sort({ createdAt: 1 }).select('createdAt').lean();
              if (!opener) return;

              const deltaMin = (Date.now() - new Date(opener.createdAt).getTime()) / 60000;
              const senderDoc = await User.findById(senderId).select('avgResponseTime').lean();
              if (!senderDoc) return;

              const prev = senderDoc.avgResponseTime;
              const newAvg = prev == null ? Math.round(deltaMin) : Math.round(prev * 0.8 + deltaMin * 0.2);
              User.updateOne({ _id: senderId }, { avgResponseTime: newAvg }).exec().catch(() => {});
            } catch (_) {}
          });
          // ─────────────────────────────────────────────────────────────

          await newMessage.populate('sender', 'firstName lastName profilePicture');
          await conversation.populate('participants', 'firstName lastName profilePicture');

          socket.join(conversation._id.toString());
          io.sockets.sockets.forEach(s => {
            if (s.user && s.user.userId === recipientId) {
              s.join(conversation._id.toString());
            }
          });

          const isRecipientOnline = activeUsers.has(recipientId);
          
          if (isRecipientOnline) {
            newMessage.deliveredAt = new Date();
            await newMessage.save();
            
            socket.emit('message:delivered', {
              messageId: newMessage._id.toString(),
              deliveredAt: newMessage.deliveredAt
            });
            
          }

          const messageWithId = {
            ...newMessage.toObject(),
            _id: newMessage._id.toString(),
            conversation: newMessage.conversation.toString()
          };

          socket.emit('message:receive', { message: messageWithId });

          io.to(recipientId).emit('message:receive', { message: messageWithId });

          io.to(senderId).emit('conversation:update', { conversation });
          io.to(recipientId).emit('conversation:update', { conversation });

        }

      } catch (err) {
        console.error('Error handling message:send:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('message:read', async (data) => {
      if (!consumeRate('message:read', 50, 10_000)) {
        socket.emit('error', { message: 'Rate limit exceeded for read receipts' });
        return;
      }

      const { conversationId, roomId, messageIds } = data;
      const readerId = senderId;

      try {
        if ((!conversationId && !roomId) || !messageIds || !Array.isArray(messageIds)) {
          socket.emit('error', { message: 'Conversation/Room ID and message IDs array are required' });
          return;
        }


        if (roomId) {
          const room = await ChatRoom.findById(roomId);
          if (!room || !room.isMember(readerId)) {
            socket.emit('error', { message: 'Room not found or access denied' });
            return;
          }

          // Batch update instead of N+1 individual reads
          await Message.updateMany(
            { _id: { $in: messageIds }, roomId: roomId },
            { $addToSet: { readBy: readerId } }
          );


          socket.to(roomId).emit('message:read', {
            roomId,
            messageIds,
            readAt: new Date(),
            readerId
          });

        } else {
          const result = await Message.updateMany(
            { _id: { $in: messageIds }, recipient: readerId },
            { $set: { isRead: true, readAt: new Date() } }
          );


          const conversation = await Conversation.findById(conversationId);
          if (!conversation) {
            socket.emit('error', { message: 'Conversation not found' });
            return;
          }

          const senderIdString = conversation.participants.find(p => p.toString() !== readerId);
          if (senderIdString) {
            
            io.to(senderIdString.toString()).emit('message:read', {
              conversationId,
              messageIds,
              readAt: new Date(),
              readerId
            });
          } else {
          }
        }

      } catch (err) {
        console.error('Error handling message:read:', err);
        socket.emit('error', { message: 'Failed to mark messages as read' });
      }
    });

    socket.on('typing:start', (data) => {
      if (!consumeRate('typing:start', 40, 10_000)) return;

      const { conversationId, roomId } = data;
      const userId = senderId;

      try {
        if (!conversationId && !roomId) {
          socket.emit('error', { message: 'Conversation ID or Room ID is required' });
          return;
        }

        const targetId = roomId || conversationId;
        const targetType = roomId ? 'room' : 'conversation';
        
        
        socket.to(targetId).emit('typing:start', { 
          conversationId, 
          roomId, 
          userId 
        });

      } catch (err) {
        console.error('Error handling typing:start:', err);
      }
    });

    socket.on('typing:stop', (data) => {
      if (!consumeRate('typing:stop', 40, 10_000)) return;

      const { conversationId, roomId } = data;
      const userId = senderId;

      try {
        if (!conversationId && !roomId) {
          socket.emit('error', { message: 'Conversation ID or Room ID is required' });
          return;
        }

        const targetId = roomId || conversationId;
        const targetType = roomId ? 'room' : 'conversation';
        
        
        socket.to(targetId).emit('typing:stop', { 
          conversationId, 
          roomId, 
          userId 
        });

      } catch (err) {
        console.error('Error handling typing:stop:', err);
      }
    });

    socket.on('user:get_online_status', async (data) => {
      const { userIds } = data;
      const onlineStatus = {};
      
      userIds.forEach(userId => {
        onlineStatus[userId] = activeUsers.has(userId);
      });
      
      socket.emit('user:online_status', onlineStatus);
    });

    socket.on('user:sync_missed_messages', async () => {
      try {
        const undeliveredMessages = await Message.find({
          recipient: senderId,
          deliveredAt: null
        }).populate('sender', 'firstName lastName');

        const messageIds = undeliveredMessages.map(msg => msg._id);
        await Message.updateMany(
          { _id: { $in: messageIds } },
          { deliveredAt: new Date() }
        );

        for (const message of undeliveredMessages) {
          if (activeUsers.has(message.sender._id.toString())) {
            io.to(message.sender._id.toString()).emit('message:delivered', {
              messageId: message._id.toString(),
              deliveredAt: new Date()
            });
          }
        }

      } catch (error) {
        console.error('🔄 Error syncing missed messages:', error);
      }
    });

    socket.on('room:join', async (data) => {
      const { roomId } = data;
      const userId = senderId;

      try {
        if (!roomId) {
          socket.emit('error', { message: 'Room ID is required' });
          return;
        }

        const room = await ChatRoom.findById(roomId);
        if (!room || !room.isMember(userId)) {
          socket.emit('error', { message: 'Room not found or access denied' });
          return;
        }

        socket.join(roomId);
        
        socket.emit('room:joined', { roomId, roomName: room.name });
        socket.to(roomId).emit('user:joined_room', { userId, roomId });

      } catch (err) {
        console.error('Error handling room:join:', err);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    socket.on('room:leave', async (data) => {
      const { roomId } = data;
      const userId = senderId;

      try {
        if (!roomId) {
          socket.emit('error', { message: 'Room ID is required' });
          return;
        }

        socket.leave(roomId);
        
        socket.emit('room:left', { roomId });
        socket.to(roomId).emit('user:left_room', { userId, roomId });

      } catch (err) {
        console.error('Error handling room:leave:', err);
        socket.emit('error', { message: 'Failed to leave room' });
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // VIDEO/AUDIO CALL EVENTS (WebRTC signaling)
    // ═══════════════════════════════════════════════════════════════

    socket.on('call:initiate', async ({ recipientId, type = 'video', jobId, conversationId }) => {
      try {
        if (!recipientId) return socket.emit('call:error', { message: 'recipientId required' });
        if (!activeUsers.has(recipientId)) {
          return socket.emit('call:error', { message: 'User is offline' });
        }

        const call = await Call.create({
          caller: senderId, recipient: recipientId, type, status: 'ringing',
          job: jobId || null, conversation: conversationId || null,
        });

        const caller = await User.findById(senderId).select('firstName lastName profileImage').lean();
        io.to(recipientId).emit('call:incoming', { callId: call._id, caller: { _id: senderId, ...caller }, type });
        socket.emit('call:initiated', { callId: call._id });

        setTimeout(async () => {
          const c = await Call.findById(call._id);
          if (c && c.status === 'ringing') {
            c.status = 'missed'; c.endReason = 'timeout'; await c.save();
            io.to(senderId).emit('call:ended', { callId: call._id, reason: 'timeout' });
            io.to(recipientId).emit('call:ended', { callId: call._id, reason: 'timeout' });
          }
        }, 30000);
      } catch (err) {
        console.error('call:initiate error:', err.message);
        socket.emit('call:error', { message: 'Failed to initiate call' });
      }
    });

    socket.on('call:accept', async ({ callId }) => {
      try {
        const call = await Call.findById(callId);
        if (!call || call.recipient.toString() !== senderId) return socket.emit('call:error', { message: 'Call not found' });
        if (call.status !== 'ringing') return socket.emit('call:error', { message: 'Call is no longer ringing' });

        call.status = 'active'; call.startedAt = new Date(); await call.save();
        const recipient = await User.findById(senderId).select('firstName lastName profileImage').lean();
        io.to(call.caller.toString()).emit('call:accepted', { callId, recipient: { _id: senderId, ...recipient } });
        socket.emit('call:accepted', { callId });
      } catch (err) {
        console.error('call:accept error:', err.message);
        socket.emit('call:error', { message: 'Failed to accept call' });
      }
    });

    socket.on('call:reject', async ({ callId }) => {
      try {
        const call = await Call.findById(callId);
        if (!call || call.recipient.toString() !== senderId) return;
        call.status = 'rejected'; call.endReason = 'recipient_rejected'; await call.save();
        io.to(call.caller.toString()).emit('call:ended', { callId, reason: 'rejected' });
        socket.emit('call:ended', { callId, reason: 'rejected' });
      } catch (err) { console.error('call:reject error:', err.message); }
    });

    socket.on('call:end', async ({ callId }) => {
      try {
        const call = await Call.findById(callId);
        if (!call) return;
        const isCaller = call.caller.toString() === senderId;
        const isRecipient = call.recipient.toString() === senderId;
        if (!isCaller && !isRecipient) return;

        call.status = 'ended'; call.endedAt = new Date();
        call.endReason = isCaller ? 'caller_ended' : 'recipient_ended';
        if (call.startedAt) call.duration = Math.round((call.endedAt - call.startedAt) / 1000);
        await call.save();

        const otherUserId = isCaller ? call.recipient.toString() : call.caller.toString();
        io.to(otherUserId).emit('call:ended', { callId, reason: call.endReason, duration: call.duration });
        socket.emit('call:ended', { callId, reason: call.endReason, duration: call.duration });
      } catch (err) { console.error('call:end error:', err.message); }
    });

    // WebRTC signaling passthrough
    socket.on('call:offer', ({ callId, targetUserId, offer }) => {
      io.to(targetUserId).emit('call:offer', { callId, fromUserId: senderId, offer });
    });
    socket.on('call:answer', ({ callId, targetUserId, answer }) => {
      io.to(targetUserId).emit('call:answer', { callId, fromUserId: senderId, answer });
    });
    socket.on('call:ice-candidate', ({ callId, targetUserId, candidate }) => {
      io.to(targetUserId).emit('call:ice-candidate', { callId, fromUserId: senderId, candidate });
    });
    socket.on('call:media-toggle', ({ callId, targetUserId, kind, enabled }) => {
      io.to(targetUserId).emit('call:media-toggle', { callId, fromUserId: senderId, kind, enabled });
    });

    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${senderId}`);
      rateBuckets.clear();

      const userId = socketToUser.get(socket.id);
      if (userId && activeUsers.has(userId)) {
        const userSockets = activeUsers.get(userId);
        userSockets.delete(socket.id);
        
        if (userSockets.size === 0) {
          activeUsers.delete(userId);
          socket.broadcast.emit('user:offline', { userId: userId.toString(), lastSeen: new Date() });
          // Persist lastSeen — fire and forget
          User.updateOne({ _id: userId }, { lastSeen: new Date() }).exec().catch(() => {});
        }
      }
      socketToUser.delete(socket.id);
    });
  });

  async function rejoinUserRooms(socket, userId) {
    try {
      const conversations = await Conversation.find({
        participants: userId
      });

      conversations.forEach(conversation => {
        socket.join(conversation._id.toString());
      });

      const chatrooms = await ChatRoom.find({
        'members.user': userId,
        isActive: true
      });

      chatrooms.forEach(room => {
        socket.join(room._id.toString());
      });

      socket.emit('user:sync_missed_messages');
      
    } catch (error) {
      console.error('🔄 Error rejoining rooms:', error);
    }
  }
};
