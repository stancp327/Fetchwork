const { Message, Conversation } = require('../models/Message');

module.exports = (io) => {
  io.on('connection', (socket) => {
    const senderId = socket.user.userId;
    console.log(`🔌 User connected: ${senderId}`);
    
    socket.join(senderId);
    console.log(`🏠 User ${senderId} joined room: ${senderId}`);

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

        console.log(`📤 Emitting message:receive to sender ${senderId}`);
        socket.emit('message:receive', { message: newMessage });

        console.log(`📤 Emitting message:receive to recipient room ${recipientId}`);
        io.to(recipientId).emit('message:receive', { message: newMessage });

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

    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${senderId}`);
    });
  });
};
