const { Message, Conversation } = require('../models/Message');
const User = require('../models/User');

const activeUsers = new Map(); // userId -> Set of socketIds
const socketToUser = new Map(); // socketId -> userId

module.exports = (io) => {
  io.on('connection', (socket) => {
    const senderId = socket.user.userId;
    console.log(`🔌 User connected: ${senderId}`);
    
    socket.join(senderId);
    console.log(`🏠 User ${senderId} joined room: ${senderId}`);
    
    socketToUser.set(socket.id, senderId);
    
    if (!activeUsers.has(senderId)) {
      activeUsers.set(senderId, new Set());
      socket.broadcast.emit('user:online', { userId: senderId });
      console.log(`👁️ User ${senderId} is now online`);
    }
    activeUsers.get(senderId).add(socket.id);
    
    rejoinUserRooms(socket, senderId);

    socket.on('message:send', async (data) => {
      const { recipientId, content, messageType = 'text', attachments = [], jobId } = data;

      try {
        if (!recipientId || !content) {
          socket.emit('error', { message: 'Recipient and message content are required' });
          return;
        }

        if (recipientId === senderId) {
          socket.emit('error', { message: 'Cannot send message to yourself' });
          return;
        }

        console.log(`🔍 Looking for conversation between ${senderId} and ${recipientId}`);
        let conversation = await Conversation.findByParticipants(senderId, recipientId);
        console.log(`🔍 Found existing conversation:`, conversation?._id);
        
        if (!conversation) {
          console.log(`🆕 Creating new conversation between ${senderId} and ${recipientId}`);
          conversation = new Conversation({
            participants: [senderId, recipientId],
            job: jobId || null
          });
          await conversation.save();
          console.log(`✅ Created conversation:`, conversation._id);
        }

        console.log(`📝 Creating message with conversation ID: ${conversation._id}`);
        const newMessage = await Message.create({
          conversation: conversation._id,
          sender: senderId,
          recipient: recipientId,
          content,
          messageType,
          attachments,
          isRead: false
        });
        console.log(`✅ Created message:`, newMessage._id);

        conversation.lastMessage = newMessage._id;
        await conversation.updateLastActivity();

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
          
          console.log(`📦 Message ${newMessage._id} delivered to online recipient`);
        }

        const messageWithId = {
          ...newMessage.toObject(),
          _id: newMessage._id.toString(),
          conversation: newMessage.conversation.toString()
        };

        console.log(`📤 Emitting message:receive to sender ${senderId}`);
        console.log(`🔍 Message object being emitted:`, JSON.stringify(messageWithId, null, 2));
        socket.emit('message:receive', { message: messageWithId });

        console.log(`📤 Emitting message:receive to recipient room ${recipientId}`);
        io.to(recipientId).emit('message:receive', { message: messageWithId });

        console.log(`📤 Emitting conversation:update to sender ${senderId}`);
        io.to(senderId).emit('conversation:update', { conversation });
        console.log(`📤 Emitting conversation:update to recipient ${recipientId}`);
        io.to(recipientId).emit('conversation:update', { conversation });

        console.log(`📨 Message sent from ${senderId} to ${recipientId} in conversation ${conversation._id}`);

      } catch (err) {
        console.error('Error handling message:send:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('message:read', async (data) => {
      const { conversationId, messageIds } = data;
      const readerId = senderId;

      try {
        if (!conversationId || !messageIds || !Array.isArray(messageIds)) {
          socket.emit('error', { message: 'Conversation ID and message IDs array are required' });
          return;
        }

        console.log(`👁️ User ${readerId} marking messages as read:`, messageIds);

        const result = await Message.updateMany(
          { _id: { $in: messageIds }, recipient: readerId },
          { $set: { isRead: true, readAt: new Date() } }
        );

        console.log(`✅ Marked ${result.modifiedCount} messages as read`);

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }

        const senderIdString = conversation.participants.find(p => p.toString() !== readerId);
        if (senderIdString) {
          console.log(`📤 Emitting message:read to sender ${senderIdString.toString()}`);
          
          io.to(senderIdString.toString()).emit('message:read', {
            conversationId,
            messageIds,
            readAt: new Date(),
            readerId
          });
        } else {
          console.log(`❌ No sender found in conversation participants for read receipt`);
          console.log(`❌ Available participants:`, conversation.participants.map(p => p.toString()));
        }

      } catch (err) {
        console.error('Error handling message:read:', err);
        socket.emit('error', { message: 'Failed to mark messages as read' });
      }
    });

    socket.on('typing:start', (data) => {
      const { conversationId } = data;
      const userId = senderId;

      try {
        if (!conversationId) {
          socket.emit('error', { message: 'Conversation ID is required' });
          return;
        }

        console.log(`⌨️ User ${userId} started typing in conversation ${conversationId}`);
        
        socket.to(conversationId).emit('typing:start', { conversationId, userId });

      } catch (err) {
        console.error('Error handling typing:start:', err);
      }
    });

    socket.on('typing:stop', (data) => {
      const { conversationId } = data;
      const userId = senderId;

      try {
        if (!conversationId) {
          socket.emit('error', { message: 'Conversation ID is required' });
          return;
        }

        console.log(`⌨️ User ${userId} stopped typing in conversation ${conversationId}`);
        
        socket.to(conversationId).emit('typing:stop', { conversationId, userId });

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
      console.log(`👁️ Sent online status for users:`, onlineStatus);
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

        console.log(`🔄 Marked ${messageIds.length} messages as delivered for user ${senderId}`);
      } catch (error) {
        console.error('🔄 Error syncing missed messages:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${senderId}`);
      
      const userId = socketToUser.get(socket.id);
      if (userId && activeUsers.has(userId)) {
        const userSockets = activeUsers.get(userId);
        userSockets.delete(socket.id);
        
        if (userSockets.size === 0) {
          activeUsers.delete(userId);
          socket.broadcast.emit('user:offline', { userId });
          console.log(`👁️ User ${userId} is now offline`);
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
        console.log(`🔄 User ${userId} rejoined conversation room: ${conversation._id}`);
      });

      socket.emit('user:sync_missed_messages');
      
    } catch (error) {
      console.error('🔄 Error rejoining rooms:', error);
    }
  }

  io.getActiveUsers = () => activeUsers;
  io.isUserOnline = (userId) => activeUsers.has(userId);
};
