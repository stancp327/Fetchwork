const { generateTestToken, createSocketConnectionAsync, testUsers, testRoomIds } = require('../test-utils/common');

console.log('🧪 Testing Phase 2 - Real-time Messaging Events...');

const user1Token = generateTestToken(testUsers.user1.userId, { email: testUsers.user1.email });
const user2Token = generateTestToken(testUsers.user2.userId, { email: testUsers.user2.email });

const testConversationId = testRoomIds.conversation;// Valid ObjectId format

let user1Socket, user2Socket;
let messagesReceived = [];

console.log('\n1. Connecting User 1...');
createSocketConnectionAsync(user1Token, 'User1').then(socket => {
  user1Socket = socket;
  console.log('\n2. Connecting User 2...');
  return createSocketConnectionAsync(user2Token, 'User2');
}).then(socket => {
  user2Socket = socket;
  
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
        recipientId: testUsers.user2.userId,
        content: 'Hello from User 1! Testing real-time messaging.',
        messageType: 'text'
      });
      
      setTimeout(() => {
        console.log('\n4. User 2 sending reply to User 1...');
        user2Socket.emit('message:send', {
          recipientId: testUsers.user1.userId,
          content: 'Hello back from User 2! Real-time messaging works!',
          messageType: 'text'
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
}).catch(error => {
  console.log('❌ Connection error:', error.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('❌ Test timed out');
  process.exit(1);
}, 15000);
