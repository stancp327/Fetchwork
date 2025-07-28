const { generateTestToken, testUsers, testRoomIds, SOCKET_URL } = require('./test-utils/common');
const io = require('socket.io-client');

const testUser1 = { userId: '6880b8a532a788ddd046dd1e' };
const testUser2 = { userId: '507f1f77bcf86cd799439012' };
const testUser3 = { userId: '507f1f77bcf86cd799439013' };

function generateToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

async function testGroupMessagingSocket() {
  console.log('🧪 Testing Phase 5.3 Group Messaging Socket Logic...\n');
  
  const token1 = generateToken(testUser1);
  const token2 = generateToken(testUser2);
  const token3 = generateToken(testUser3);
  
  const socket1 = io(SOCKET_URL, { auth: { token: token1 } });
  const socket2 = io(SOCKET_URL, { auth: { token: token2 } });
  const socket3 = io(SOCKET_URL, { auth: { token: token3 } });
  
  const testRoomId = '6880bb44ee2b076704294fe6'; // From previous REST test
  
  return new Promise((resolve) => {
    let testsCompleted = 0;
    const totalTests = 6;
    
    function checkCompletion() {
      testsCompleted++;
      if (testsCompleted >= totalTests) {
        console.log('\n🎉 All Phase 5.3 Socket Logic tests completed!');
        socket1.disconnect();
        socket2.disconnect();
        socket3.disconnect();
        resolve(true);
      }
    }
    
    socket1.on('connect', () => {
      console.log('✅ User1 connected to socket');
      checkCompletion();
    });
    
    socket2.on('connect', () => {
      console.log('✅ User2 connected to socket');
      checkCompletion();
    });
    
    socket2.on('message:receive', (data) => {
      if (data.message.roomId === testRoomId) {
        console.log('✅ User2 received group message:', data.message.content);
        checkCompletion();
      }
    });
    
    socket3.on('message:receive', (data) => {
      if (data.message.roomId === testRoomId) {
        console.log('✅ User3 received group message:', data.message.content);
        checkCompletion();
      }
    });
    
    socket2.on('typing:start', (data) => {
      if (data.roomId === testRoomId) {
        console.log('✅ User2 received typing indicator from User1 in room');
        checkCompletion();
      }
    });
    
    socket1.on('message:read', (data) => {
      if (data.roomId === testRoomId) {
        console.log('✅ User1 received read receipt from User2 in room');
        checkCompletion();
      }
    });
    
    setTimeout(() => {
      console.log('\n🔥 Starting group messaging tests...\n');
      
      console.log('1️⃣ Testing group message sending...');
      socket1.emit('message:send', {
        roomId: testRoomId,
        content: 'Hello group! This is a test message from User1',
        messageType: 'text',
        mentions: [testUser2.userId]
      });
      
      setTimeout(() => {
        console.log('2️⃣ Testing group typing indicators...');
        socket1.emit('typing:start', { roomId: testRoomId });
        
        setTimeout(() => {
          socket1.emit('typing:stop', { roomId: testRoomId });
        }, 1000);
      }, 2000);
      
      setTimeout(() => {
        console.log('3️⃣ Testing group read receipts...');
        socket2.emit('message:read', {
          roomId: testRoomId,
          messageIds: ['dummy-message-id'] // Will be replaced with actual message ID in real usage
        });
      }, 4000);
      
    }, 1000);
    
    setTimeout(() => {
      console.log('\n⏰ Test timeout reached');
      socket1.disconnect();
      socket2.disconnect();
      socket3.disconnect();
      resolve(false);
    }, 10000);
  });
}

testGroupMessagingSocket()
  .then(success => {
    if (success) {
      console.log('\n✅ Phase 5.3 Socket Logic: VERIFIED');
      process.exit(0);
    } else {
      console.log('\n❌ Phase 5.3 Socket Logic: FAILED');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
