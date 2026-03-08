const mongoose = require('mongoose');
const { Message, Conversation, ChatRoom, ReceiptCursor } = require('../models/Message');
const User = require('../models/User');
const Call = require('../models/Call');
const { transitionCall } = require('../services/callStateMachine');
const { detectOffPlatform } = require('../services/offPlatformDetector');
const ModerationEvent = require('../models/ModerationEvent');

const activeUsers = new Map(); // userId -> Set of socketIds
const socketToUser = new Map(); // socketId -> userId

module.exports = (io) => {
  io.on('connection', (socket) => {
    const senderId = String(socket.user?.userId || socket.user?.id || socket.user?._id || '');
    if (!senderId) {
      socket.disconnect(true);
      return;
    }
    console.log(`🔌 User connected: ${senderId}`);

    // Lightweight per-socket rate limiter (anti-spam / abuse control)
    const rateBuckets = new Map();
    const socketDiagEnabled = process.env.FF_SOCKET_DIAGNOSTICS === 'true';
    const getCid = (payload) => payload?.correlationId || payload?.requestId || `sock-${Date.now()}`;
    const ackOk = (ack, payload, data = {}) => {
      if (typeof ack !== 'function') return;
      ack({ ok: true, serverTs: Date.now(), requestId: payload?.requestId || null, correlationId: getCid(payload), data });
    };
    const ackErr = (ack, payload, code, message, retryable = false) => {
      if (typeof ack !== 'function') return;
      ack({ ok: false, code, message, retryable, serverTs: Date.now(), requestId: payload?.requestId || null, correlationId: getCid(payload) });
    };
    const logSocketError = (scope, payload, err) => {
      const cid = getCid(payload);
      console.error(`[socket:${scope}] cid=${cid} user=${senderId} err=${err.message}`);
    };
    const emitDiag = (phase, payload = {}) => {
      if (!socketDiagEnabled) return;
      const packet = { phase, at: Date.now(), userId: senderId, socketId: socket.id, ...payload };
      socket.emit('diag:socket', packet);
      console.log(`[socket:diag] ${phase} user=${senderId} socket=${socket.id} ${JSON.stringify(payload)}`);
    };
    const recordModerationEvent = async ({ conversationId = null, roomId = null, messageId = null, userId, safety, source = 'socket' }) => {
      try {
        if (!safety) return;
        if ((safety.score || 0) <= 0 && (!safety.hits || safety.hits.length === 0)) return;
        await ModerationEvent.create({
          conversationId,
          roomId,
          messageId,
          userId,
          score: safety.score || 0,
          confidence: safety.confidence || 'low',
          action: safety.action || 'allow',
          ruleIds: safety.hits || [],
          source,
        });
      } catch (_) {}
    };
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
    emitDiag('connect:joined-user-room', { room: senderId });

    socketToUser.set(socket.id, senderId);
    
    if (!activeUsers.has(senderId)) {
      activeUsers.set(senderId, new Set());
      socket.broadcast.emit('user:online', { userId: senderId });
    }
    activeUsers.get(senderId).add(socket.id);
    
    rejoinUserRooms(socket, senderId);

    socket.on('message:send', async (data, ack) => {
      if (!consumeRate('message:send', 30, 10_000)) {
        ackErr(ack, data, 'ERR_RATE_LIMIT', 'Rate limit exceeded for sending messages', true);
        socket.emit('error', { message: 'Rate limit exceeded for sending messages', correlationId: getCid(data) });
        return;
      }

      const { recipientId, roomId, content, messageType = 'text', attachments = [], jobId, mentions = [], requestId = null } = data || {};
      const normalizedRecipientId = recipientId != null ? String(recipientId) : null;
      if (typeof content !== 'string' || !content.trim()) {
        ackErr(ack, data, 'ERR_VALIDATION', 'Message content is required');
        socket.emit('error', { message: 'Message content is required', correlationId: getCid(data) });
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

          const roomSeqEnabled = process.env.FF_ROOM_SEQ_V1 === 'true';
          let roomAfterSeq = room;
          if (roomSeqEnabled) {
            roomAfterSeq = await ChatRoom.findByIdAndUpdate(
              roomId,
              { $inc: { seq: 1 }, $set: { lastActivity: new Date(), lastMessageSeq: (room.seq || 0) + 1 } },
              { new: true }
            );
          } else {
            await room.updateLastActivity();
          }

          const safety = detectOffPlatform(content);
          const newMessage = await Message.create({
            roomId,
            ...(roomSeqEnabled ? { seq: roomAfterSeq.seq } : {}),
            sender: senderId,
            content,
            messageType,
            attachments,
            mentions,
            safety,
          });
          await recordModerationEvent({ roomId, messageId: newMessage._id, userId: senderId, safety, source: 'socket' });
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
          if (newMessage.safety?.action === 'nudge' || newMessage.safety?.action === 'warn') {
            socket.emit('safety:nudge', {
              conversationId: null,
              roomId,
              action: newMessage.safety.action,
              copy: 'For your safety, we recommend staying on-platform. Scams are possible.',
            });
          }
          ackOk(ack, data, { messageId: newMessage._id.toString(), roomId: roomId.toString(), safety: newMessage.safety || null });

          if (onlineMembers.length > 0) {
            socket.emit('message:delivered', {
              messageId: newMessage._id.toString(),
              deliveredTo: onlineMembers.map(m => m.user.toString()),
              deliveredAt: new Date()
            });
          }


        } else {
          if (!normalizedRecipientId || !content) {
            socket.emit('error', { message: 'Recipient and message content are required' });
            return;
          }

          if (normalizedRecipientId === senderId) {
            socket.emit('error', { message: 'Cannot send message to yourself' });
            return;
          }

          let conversation = await Conversation.findByParticipants(senderId, normalizedRecipientId);

          if (!conversation) {
            conversation = new Conversation({
              participants: [senderId, normalizedRecipientId],
              job: jobId || null,
              seq: 0,
            });
            await conversation.save();
          }

          // Idempotency: if requestId already exists for this sender/conversation, return existing message.
          let newMessage = null;
          if (requestId) {
            newMessage = await Message.findOne({
              conversation: conversation._id,
              sender: senderId,
              requestId,
            });
          }

          if (!newMessage) {
            const session = await mongoose.startSession();
            try {
              await session.withTransaction(async () => {
                const convo = await Conversation.findByIdAndUpdate(
                  conversation._id,
                  { $inc: { seq: 1 }, $set: { lastActivity: new Date() } },
                  { new: true, session }
                );

                const safety = detectOffPlatform(content);
                const [created] = await Message.create([
                  {
                    conversation: conversation._id,
                    seq: convo.seq,
                    requestId,
                    sender: senderId,
                    recipient: normalizedRecipientId,
                    content,
                    messageType,
                    attachments,
                    safety,
                    isRead: false,
                  },
                ], { session });

                newMessage = created;

                await Conversation.updateOne(
                  { _id: conversation._id },
                  { $set: { lastMessage: newMessage._id, lastMessageSeq: convo.seq, lastMessageAt: new Date() } },
                  { session }
                );
              });
            } catch (txErr) {
              if (txErr?.code === 11000 && requestId) {
                newMessage = await Message.findOne({ conversation: conversation._id, sender: senderId, requestId });
              } else {
                throw txErr;
              }
            } finally {
              await session.endSession();
            }
          } else {
            await Conversation.updateOne(
              { _id: conversation._id },
              { $set: { lastMessage: newMessage._id, lastActivity: new Date(), lastMessageAt: new Date(), lastMessageSeq: newMessage.seq || 0 } }
            );
          }

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
            if (s.user && String(s.user.userId) === normalizedRecipientId) {
              s.join(conversation._id.toString());
            }
          });

          const isRecipientOnline = activeUsers.has(normalizedRecipientId);
          
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

          const conversationRoomId = conversation._id.toString();
          socket.emit('message:receive', { message: messageWithId });
          io.to(normalizedRecipientId).emit('message:receive', { message: messageWithId });
          io.to(conversationRoomId).emit('message:receive', { message: messageWithId });

          emitDiag('message:receive:emits', {
            cid: getCid(data),
            conversationId: conversationRoomId,
            recipientRoom: normalizedRecipientId,
            senderRoom: senderId,
            recipientOnline: isRecipientOnline,
            messageId: messageWithId._id,
            seq: messageWithId.seq || null,
          });

          await recordModerationEvent({ conversationId: conversation._id, messageId: newMessage._id, userId: senderId, safety: newMessage.safety, source: 'socket' });
          io.to(senderId).emit('conversation:update', { conversation });
          io.to(normalizedRecipientId).emit('conversation:update', { conversation });
          if (newMessage.safety?.action === 'nudge' || newMessage.safety?.action === 'warn') {
            socket.emit('safety:nudge', {
              conversationId: conversation._id.toString(),
              action: newMessage.safety.action,
              copy: 'For your safety, we recommend staying on-platform. Scams are possible.',
            });
          }
          ackOk(ack, data, {
            messageId: newMessage._id.toString(),
            conversationId: conversation._id.toString(),
            seq: newMessage.seq || null,
            safety: newMessage.safety || null,
          });

        }

      } catch (err) {
        logSocketError('message:send', data, err);
        ackErr(ack, data, 'ERR_INTERNAL', 'Failed to send message', true);
        socket.emit('error', { message: 'Failed to send message', correlationId: getCid(data) });
      }
    });

    socket.on('message:read', async (data, ack) => {
      if (!consumeRate('message:read', 50, 10_000)) {
        ackErr(ack, data, 'ERR_RATE_LIMIT', 'Rate limit exceeded for read receipts', true);
        socket.emit('error', { message: 'Rate limit exceeded for read receipts', correlationId: getCid(data) });
        return;
      }

      const { conversationId, roomId, messageIds } = data;
      const readerId = senderId;

      try {
        if ((!conversationId && !roomId) || !messageIds || !Array.isArray(messageIds)) {
          ackErr(ack, data, 'ERR_VALIDATION', 'Conversation/Room ID and message IDs array are required');
          socket.emit('error', { message: 'Conversation/Room ID and message IDs array are required', correlationId: getCid(data) });
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

          const readMax = await Message.findOne({ _id: { $in: messageIds }, conversation: conversationId })
            .sort({ seq: -1 })
            .select('seq')
            .lean();
          if (readMax?.seq) {
            await ReceiptCursor.updateOne(
              { conversationId, userId: readerId },
              { $max: { lastReadSeq: readMax.seq, lastDeliveredSeq: readMax.seq } },
              { upsert: true }
            );
          }

          const conversation = await Conversation.findById(conversationId);
          if (!conversation) {
            socket.emit('error', { message: 'Conversation not found' });
            return;
          }

          const senderIdString = conversation.participants.find(p => p.toString() !== readerId);
          if (senderIdString) {
            const cursor = await ReceiptCursor.findOne({ conversationId, userId: readerId }).lean();
            io.to(senderIdString.toString()).emit('message:read', {
              conversationId,
              messageIds,
              readAt: new Date(),
              readerId
            });
            io.to(senderIdString.toString()).emit('rcpt:update', {
              conversationId,
              userId: readerId,
              lastReadSeq: cursor?.lastReadSeq || 0,
              lastDeliveredSeq: cursor?.lastDeliveredSeq || 0,
            });
          } else {
          }
        }

        ackOk(ack, data, {
          conversationId: conversationId || null,
          roomId: roomId || null,
          messageIds,
        });
      } catch (err) {
        logSocketError('message:read', data, err);
        ackErr(ack, data, 'ERR_INTERNAL', 'Failed to mark messages as read', true);
        socket.emit('error', { message: 'Failed to mark messages as read', correlationId: getCid(data) });
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
        logSocketError('typing:start', data, err);
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
        logSocketError('typing:stop', data, err);
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

    socket.on('conv:join', async (data, ack) => {
      const { conversationId } = data || {};
      const userId = senderId;

      try {
        if (!conversationId) {
          ackErr(ack, data, 'ERR_VALIDATION', 'conversationId is required');
          socket.emit('error', { message: 'Conversation ID is required', correlationId: getCid(data) });
          return;
        }

        const conversation = await Conversation.findById(conversationId).select('participants').lean();
        const allowed = !!conversation?.participants?.some((p) => p.toString() === userId);
        if (!allowed) {
          ackErr(ack, data, 'ERR_AUTHZ', 'Conversation not found or access denied');
          socket.emit('error', { message: 'Conversation not found or access denied', correlationId: getCid(data) });
          return;
        }

        socket.join(conversationId);
        emitDiag('conv:join', { cid: getCid(data), conversationId });
        ackOk(ack, data, { conversationId });
        socket.emit('conv:joined', { conversationId, correlationId: getCid(data) });
      } catch (err) {
        logSocketError('conv:join', data, err);
        ackErr(ack, data, 'ERR_INTERNAL', 'Failed to join conversation', true);
        socket.emit('error', { message: 'Failed to join conversation', correlationId: getCid(data) });
      }
    });

    socket.on('conv:leave', async (data, ack) => {
      const { conversationId } = data || {};
      try {
        if (!conversationId) {
          ackErr(ack, data, 'ERR_VALIDATION', 'conversationId is required');
          socket.emit('error', { message: 'Conversation ID is required', correlationId: getCid(data) });
          return;
        }
        socket.leave(conversationId);
        ackOk(ack, data, { conversationId });
        socket.emit('conv:left', { conversationId, correlationId: getCid(data) });
      } catch (err) {
        logSocketError('conv:leave', data, err);
        ackErr(ack, data, 'ERR_INTERNAL', 'Failed to leave conversation', true);
        socket.emit('error', { message: 'Failed to leave conversation', correlationId: getCid(data) });
      }
    });

    socket.on('room:join', async (data, ack) => {
      const { roomId } = data || {};
      const userId = senderId;

      try {
        if (!roomId) {
          ackErr(ack, data, 'ERR_VALIDATION', 'roomId is required');
          socket.emit('error', { message: 'Room ID is required', correlationId: getCid(data) });
          return;
        }

        const room = await ChatRoom.findById(roomId);
        if (!room || !room.isMember(userId)) {
          ackErr(ack, data, 'ERR_AUTHZ', 'Room not found or access denied');
          socket.emit('error', { message: 'Room not found or access denied', correlationId: getCid(data) });
          return;
        }

        socket.join(roomId);
        ackOk(ack, data, { roomId, roomName: room.name });
        socket.emit('room:joined', { roomId, roomName: room.name, correlationId: getCid(data) });
        socket.to(roomId).emit('user:joined_room', { userId, roomId });

      } catch (err) {
        logSocketError('room:join', data, err);
        ackErr(ack, data, 'ERR_INTERNAL', 'Failed to join room', true);
        socket.emit('error', { message: 'Failed to join room', correlationId: getCid(data) });
      }
    });

    socket.on('room:leave', async (data, ack) => {
      const { roomId } = data || {};
      const userId = senderId;

      try {
        if (!roomId) {
          ackErr(ack, data, 'ERR_VALIDATION', 'roomId is required');
          socket.emit('error', { message: 'Room ID is required', correlationId: getCid(data) });
          return;
        }

        socket.leave(roomId);
        ackOk(ack, data, { roomId });
        socket.emit('room:left', { roomId, correlationId: getCid(data) });
        socket.to(roomId).emit('user:left_room', { userId, roomId });

      } catch (err) {
        logSocketError('room:leave', data, err);
        ackErr(ack, data, 'ERR_INTERNAL', 'Failed to leave room', true);
        socket.emit('error', { message: 'Failed to leave room', correlationId: getCid(data) });
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // VIDEO/AUDIO CALL EVENTS (WebRTC signaling)
    // ═══════════════════════════════════════════════════════════════

    const emitCallState = (call, reason = null) => {
      if (!call) return;
      const payload = {
        callId: call._id,
        state: call.status,
        reason,
        version: call.version || 1,
        participants: (call.participants || []).map((p) => ({
          userId: p.userId,
          state: p.state,
          role: p.role,
        })),
      };
      io.to(call.caller.toString()).emit('call:state', payload);
      io.to(call.recipient.toString()).emit('call:state', payload);
    };

    const callTimelineContent = {
      call_initiated: '📞 Call started',
      call_accepted: '✅ Call accepted',
      call_missed:   '📵 Missed call',
      call_ended:    '📴 Call ended',
    };

    const writeCallTimelineMessage = async (call, subtype, extra = {}) => {
      try {
        if (!call?.conversation) return;
        await Message.create({
          conversation: call.conversation,
          sender: call.caller,
          recipient: call.recipient,
          content: callTimelineContent[subtype] || `Call ${subtype.replace('call_', '')}`,
          messageType: 'system',
          metadata: {
            type: subtype,
            callId: call._id,
            ...extra,
          },
        });
      } catch (err) {
        logSocketError('call:timeline', { correlationId: `call-timeline-${Date.now()}` }, err);
      }
    };

    const writeOfflineCallAttemptMessage = async ({ callerId, recipientId, conversationId, type = 'video' }) => {
      try {
        let convoId = conversationId;
        if (!convoId) {
          const convo = await Conversation.findByParticipants(callerId, recipientId).select('_id').lean();
          convoId = convo?._id;
        }
        if (!convoId) return;

        const caller = await User.findById(callerId).select('firstName lastName').lean();
        const callerName = `${caller?.firstName || 'Someone'} ${caller?.lastName || ''}`.trim();

        const message = await Message.create({
          conversation: convoId,
          sender: callerId,
          recipient: recipientId,
          content: `📞 ${callerName} tried to start a ${type} call while you were offline.`,
          messageType: 'system',
          metadata: {
            type: 'call_offline_attempt',
            callType: type,
          },
        });

        await Conversation.updateOne(
          { _id: convoId },
          { $set: { lastMessage: message._id, lastMessageAt: new Date(), lastActivity: new Date() } }
        );
      } catch (err) {
        logSocketError('call:offline_notice', { correlationId: `call-offline-${Date.now()}` }, err);
      }
    };

    socket.on('call:initiate', async ({ recipientId, type = 'video', jobId, conversationId }) => {
      try {
        if (!consumeRate('call:initiate', 6, 60_000)) {
          return socket.emit('call:rate-limit', { action: 'call:initiate' });
        }
        const normalizedRecipientId = recipientId ? String(recipientId) : null;
        if (!normalizedRecipientId) return socket.emit('call:error', { message: 'recipientId required' });
        if (!activeUsers.has(normalizedRecipientId)) {
          await writeOfflineCallAttemptMessage({ callerId: senderId, recipientId: normalizedRecipientId, conversationId, type });
          socket.emit('call:error', { message: 'User is offline — they were notified in chat.' });
          return;
        }

        const call = await Call.create({
          caller: senderId,
          recipient: normalizedRecipientId,
          type,
          status: 'ringing',
          job: jobId || null,
          conversation: conversationId || null,
        });

        const caller = await User.findById(senderId).select('firstName lastName profileImage').lean();
        io.to(normalizedRecipientId).emit('call:incoming', { callId: call._id, caller: { _id: senderId, ...caller }, type });
        socket.emit('call:initiated', { callId: call._id, roomId: call.roomId, status: call.status });
        emitCallState(call);
        await writeCallTimelineMessage(call, 'call_initiated', { status: call.status });

        setTimeout(async () => {
          const c = await Call.findById(call._id);
          if (c && c.status === 'ringing') {
            await transitionCall(c, 'missed', { reason: 'timeout' });
            emitCallState(c, 'timeout');
            io.to(senderId).emit('call:ended', { callId: call._id, reason: 'timeout' });
            io.to(normalizedRecipientId).emit('call:ended', { callId: call._id, reason: 'timeout' });
          }
        }, 30_000);
      } catch (err) {
        logSocketError('call:initiate', { correlationId: `call-init-${Date.now()}` }, err);
        socket.emit('call:error', { message: 'Failed to initiate call' });
      }
    });

    socket.on('call:accept', async ({ callId }) => {
      try {
        const call = await Call.findById(callId);
        if (!call || call.recipient.toString() !== senderId) return socket.emit('call:error', { message: 'Call not found' });
        if (call.status !== 'ringing') return socket.emit('call:error', { message: 'Call is no longer ringing' });

        await transitionCall(call, 'accepted');
        emitCallState(call);
        await writeCallTimelineMessage(call, 'call_accepted', { status: call.status });
        const recipient = await User.findById(senderId).select('firstName lastName profileImage').lean();
        io.to(call.caller.toString()).emit('call:accepted', { callId, recipient: { _id: senderId, ...recipient } });
        socket.emit('call:accepted', { callId });
      } catch (err) {
        logSocketError('call:accept', { correlationId: `call-accept-${Date.now()}` }, err);
        socket.emit('call:error', { message: 'Failed to accept call' });
      }
    });

    socket.on('call:reject', async ({ callId }) => {
      try {
        const call = await Call.findById(callId);
        if (!call || call.recipient.toString() !== senderId) return;
        await transitionCall(call, 'declined', { actorId: senderId, reason: 'recipient_declined' });
        emitCallState(call, 'recipient_declined');
        await writeCallTimelineMessage(call, 'call_missed', { reason: 'recipient_declined' });
        io.to(call.caller.toString()).emit('call:ended', { callId, reason: 'declined' });
        socket.emit('call:ended', { callId, reason: 'declined' });
      } catch (err) { logSocketError('call:reject', { correlationId: `call-reject-${Date.now()}` }, err); }
    });

    socket.on('call:end', async ({ callId }) => {
      try {
        const call = await Call.findById(callId);
        if (!call) return;
        const isCaller = call.caller.toString() === senderId;
        const isRecipient = call.recipient.toString() === senderId;
        if (!isCaller && !isRecipient) return;

        await transitionCall(call, 'ended', {
          actorId: senderId,
          reason: isCaller ? 'caller_ended' : 'recipient_ended',
        });
        emitCallState(call, call.endReason);
        await writeCallTimelineMessage(call, 'call_ended', { reason: call.endReason, duration: call.duration || 0 });

        const otherUserId = isCaller ? call.recipient.toString() : call.caller.toString();
        io.to(otherUserId).emit('call:ended', { callId, reason: call.endReason, duration: call.duration });
        socket.emit('call:ended', { callId, reason: call.endReason, duration: call.duration });
      } catch (err) { logSocketError('call:end', { correlationId: `call-end-${Date.now()}` }, err); }
    });

    // WebRTC signaling passthrough (participant authorization + basic state checks)
    const relayIfAuthorized = async (callId, targetUserId, eventName, payload) => {
      const call = await Call.findById(callId).select('caller recipient status').lean();
      if (!call) return;
      const isParticipant = call.caller.toString() === senderId || call.recipient.toString() === senderId;
      const targetIsParticipant = call.caller.toString() === targetUserId || call.recipient.toString() === targetUserId;
      if (!isParticipant || !targetIsParticipant) return;
      if (['ending', 'ended', 'declined', 'missed', 'failed', 'timed_out', 'canceled', 'fraud_blocked'].includes(call.status)) return;
      io.to(targetUserId).emit(eventName, payload);
    };

    socket.on('call:offer', async ({ callId, targetUserId, offer }) => {
      await relayIfAuthorized(callId, targetUserId, 'call:offer', { callId, fromUserId: senderId, offer });
    });
    socket.on('call:answer', async ({ callId, targetUserId, answer }) => {
      try {
        const call = await Call.findById(callId);
        if (call) {
          if (call.status === 'ringing') {
            await transitionCall(call, 'accepted').catch(() => {});
          }
          if (['accepted', 'ringing'].includes(call.status)) {
            await transitionCall(call, 'connecting').catch(() => {});
          }
        }

        await relayIfAuthorized(callId, targetUserId, 'call:answer', { callId, fromUserId: senderId, answer });

        const postRelayCall = await Call.findById(callId);
        if (postRelayCall && ['connecting', 'accepted'].includes(postRelayCall.status)) {
          await transitionCall(postRelayCall, 'connected').catch(() => {});
          emitCallState(postRelayCall);
        }
      } catch (err) {
        logSocketError('call:answer', { correlationId: `call-answer-${Date.now()}` }, err);
      }
    });
    socket.on('call:ice-candidate', async ({ callId, targetUserId, candidate }) => {
      await relayIfAuthorized(callId, targetUserId, 'call:ice-candidate', { callId, fromUserId: senderId, candidate });
    });
    socket.on('call:media-toggle', async ({ callId, targetUserId, kind, enabled }) => {
      await relayIfAuthorized(callId, targetUserId, 'call:media-toggle', { callId, fromUserId: senderId, kind, enabled });
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

      if (process.env.FF_SOCKET_DIAGNOSTICS === 'true') {
        socket.emit('diag:socket', {
          phase: 'rejoin:rooms',
          at: Date.now(),
          userId,
          conversationRooms: conversations.map(c => c._id.toString()),
          chatRooms: chatrooms.map(r => r._id.toString()),
        });
      }

      socket.emit('user:sync_missed_messages');
      
    } catch (error) {
      console.error('🔄 Error rejoining rooms:', error);
    }
  }
};
