const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');

console.log('🧪 Testing Phase 2 - Real-time Messaging Events...');

const JWT_SECRET = 'your_jwt_secret_key_here_replace_in_production';
const user1Token = jwt.sign({ userId: 'user1_test_id' }, JWT_SECRET, { expiresIn: '1h' });
const user2Token = jwt.sign({ userId: 'user2_test_id' }, JWT_SECRET, { expiresIn: '1h' });

const testConversationId = '507f1f77bcf86cd799439011'; // Valid ObjectId format

let user1Socket, user2Socket;
let messagesReceived = [];

console.log('\n1. Connecting User 1...');
user1Socket = io('http://localhost:10000', {
  auth: { token: user1Token }
});

user1Socket.on('connect', () => {
  console.log('✅ User 1 connected:', user1Socket.id);
  
  console.log('\n2. Connecting User 2...');
  user2Socket = io('http://localhost:10000', {
    auth: { token: user2Token }
  });
  
  user2Socket.on('connect', () => {
    console.log('✅ User 2 connected:', user2Socket.id);
    
    user1Socket.on('message:receive', (data) => {
      console.log('📨 User 1 received message:', data.message.content);
      messagesReceived.push({ user: 'user1', message: data.message });
    });
    
    user2Socket.on('message:receive', (data) => {
      console.log('📨 User 2 received message:', data.message.content);
      messagesReceived.push({ user: 'user2', message: data.message });
    });
    
    user1Socket.on('conversation:update', (data) => {
      console.log('🔄 User 1 conversation updated:', data.conversation._id);
    });
    
    user2Socket.on('conversation:update', (data) => {
      console.log('🔄 User 2 conversation updated:', data.conversation._id);
    });
    
    user1Socket.on('error', (error) => {
      console.log('❌ User 1 error:', error.message);
    });
    
    user2Socket.on('error', (error) => {
      console.log('❌ User 2 error:', error.message);
    });
    
    setTimeout(() => {
      console.log('\n3. User 1 sending message to User 2...');
      user1Socket.emit('message:send', {
        conversationId: testConversationId,
        content: 'Hello from User 1! Testing real-time messaging.',
        messageType: 'text',
        recipientId: 'user2_test_id'
      });
      
      setTimeout(() => {
        console.log('\n4. User 2 sending reply to User 1...');
        user2Socket.emit('message:send', {
          conversationId: testConversationId,
          content: 'Hello back from User 2! Real-time messaging works!',
          messageType: 'text',
          recipientId: 'user1_test_id'
        });
        
        setTimeout(() => {
          console.log('\n📊 Test Results:');
          console.log(`Messages received: ${messagesReceived.length}`);
          
          if (messagesReceived.length >= 4) {
            console.log('✅ SUCCESS: Both users received both messages');
            console.log('✅ Real-time messaging flow working correctly');
          } else {
            console.log('❌ PARTIAL: Some messages may not have been received');
            console.log('Received messages:', messagesReceived.map(m => `${m.user}: ${m.message.content}`));
          }
          
          user1Socket.disconnect();
          user2Socket.disconnect();
          console.log('\n🧹 Test completed, connections closed');
          process.exit(0);
        }, 2000);
      }, 1000);
    }, 500);
  });
  
  user2Socket.on('connect_error', (error) => {
    console.log('❌ User 2 connection error:', error.message);
    process.exit(1);
  });
});

user1Socket.on('connect_error', (error) => {
  console.log('❌ User 1 connection error:', error.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('❌ Test timed out');
  process.exit(1);
}, 15000);
