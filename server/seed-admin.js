const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI;

async function seedAdmin() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected');

    const result = await User.updateOne(
      { email: 'stancp327@gmail.com' },
      { $set: { userType: 'admin' } }
    );

    console.log('Update result:', result);
    
    if (result.matchedCount > 0) {
      console.log('User updated to admin successfully');
    } else {
      console.log('User not found');
    }

    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

seedAdmin();
