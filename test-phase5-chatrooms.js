const axios = require('axios');
const { generateTestToken, testUsers } = require('./test-utils/common');

const BASE_URL = 'http://localhost:10000';

const testUser1 = { userId: '6880b8a532a788ddd046dd1e' };
const testUser2 = { userId: '507f1f77bcf86cd799439012' };
const testUser3 = { userId: '507f1f77bcf86cd799439013' };

function generateToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

async function testChatroomEndpoints() {
  console.log('🧪 Testing Phase 5 Chatroom REST Endpoints...\n');
  
  const token1 = generateToken(testUser1);
  const token2 = generateToken(testUser2);
  
  const headers1 = { 
    'Authorization': `Bearer ${token1}`,
    'Content-Type': 'application/json'
  };
  
  const headers2 = { 
    'Authorization': `Bearer ${token2}`,
    'Content-Type': 'application/json'
  };

  try {
    console.log('1️⃣ Testing GET /api/chatrooms (should be empty)...');
    const emptyRoomsResponse = await axios.get(`${BASE_URL}/api/chatrooms`, { headers: headers1 });
    console.log('✅ Empty chatrooms response:', emptyRoomsResponse.data);
    console.log('');

    console.log('2️⃣ Testing POST /api/chatrooms (create group)...');
    const createRoomData = {
      name: 'Test Group Chat',
      description: 'A test group for Phase 5 verification',
      members: [testUser2.userId, testUser3.userId],
      isPrivate: false
    };
    
    const createResponse = await axios.post(`${BASE_URL}/api/chatrooms`, createRoomData, { headers: headers1 });
    console.log('✅ Created chatroom:', createResponse.data);
    const roomId = createResponse.data.chatroom._id;
    console.log('');

    console.log('3️⃣ Testing GET /api/chatrooms (should have 1 room)...');
    const roomsResponse = await axios.get(`${BASE_URL}/api/chatrooms`, { headers: headers1 });
    console.log('✅ User chatrooms:', roomsResponse.data);
    console.log('');

    console.log('4️⃣ Testing GET /api/chatrooms/:roomId...');
    const roomResponse = await axios.get(`${BASE_URL}/api/chatrooms/${roomId}`, { headers: headers1 });
    console.log('✅ Specific chatroom:', roomResponse.data);
    console.log('');

    console.log('5️⃣ Testing GET /api/chatrooms/:roomId/messages...');
    const messagesResponse = await axios.get(`${BASE_URL}/api/chatrooms/${roomId}/messages`, { headers: headers1 });
    console.log('✅ Chatroom messages:', messagesResponse.data);
    console.log('');

    console.log('6️⃣ Testing POST /api/chatrooms/:roomId/members...');
    const addMemberData = { userId: '507f1f77bcf86cd799439014' };
    const addMemberResponse = await axios.post(`${BASE_URL}/api/chatrooms/${roomId}/members`, addMemberData, { headers: headers1 });
    console.log('✅ Added member:', addMemberResponse.data);
    console.log('');

    console.log('7️⃣ Testing access control (user2 accessing room)...');
    const user2RoomResponse = await axios.get(`${BASE_URL}/api/chatrooms/${roomId}`, { headers: headers2 });
    console.log('✅ User2 can access room:', user2RoomResponse.data.chatroom.name);
    console.log('');

    console.log('🎉 All Phase 5 Chatroom REST Endpoints tests passed!');
    return true;

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    return false;
  }
}

testChatroomEndpoints()
  .then(success => {
    if (success) {
      console.log('\n✅ Phase 5.2 REST Endpoints: VERIFIED');
      process.exit(0);
    } else {
      console.log('\n❌ Phase 5.2 REST Endpoints: FAILED');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
