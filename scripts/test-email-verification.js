const { MongoClient, ServerApiVersion } = require('mongodb');
const crypto = require('crypto');

async function testEmailVerification() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI environment variable is required');
    process.exit(1);
  }

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const usersCollection = db.collection('users');
    
    console.log('\n=== EMAIL VERIFICATION SYSTEM TEST ===\n');
    
    const testEmail = `test-${Date.now()}@example.com`;
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    console.log(`Creating test user: ${testEmail}`);
    
    const testUser = {
      email: testEmail,
      password: '$2b$12$test.hash.for.verification.test',
      firstName: 'Test',
      lastName: 'User',
      accountType: 'freelancer',
      isVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date()
    };
    
    const insertResult = await usersCollection.insertOne(testUser);
    console.log(`✅ Test user created with ID: ${insertResult.insertedId}`);
    
    console.log('\n=== VERIFICATION TOKEN TEST ===');
    console.log(`Verification token: ${verificationToken}`);
    console.log(`Verification URL would be: ${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`);
    
    const foundUser = await usersCollection.findOne({ 
      emailVerificationToken: verificationToken,
      emailVerificationExpires: { $gt: new Date() }
    });
    
    if (foundUser) {
      console.log('✅ Verification token lookup successful');
      console.log(`   Found user: ${foundUser.email}`);
      console.log(`   Token expires: ${foundUser.emailVerificationExpires}`);
    } else {
      console.log('❌ Verification token lookup failed');
    }
    
    console.log('\n=== EMAIL SERVICE ENVIRONMENT CHECK ===');
    console.log(`RESEND_API_KEY: ${process.env.RESEND_API_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log(`FROM_EMAIL: ${process.env.FROM_EMAIL || '❌ Missing'}`);
    console.log(`CLIENT_URL: ${process.env.CLIENT_URL || '❌ Missing'}`);
    
    console.log('\n=== CLEANUP ===');
    const deleteResult = await usersCollection.deleteOne({ _id: insertResult.insertedId });
    console.log(`Test user deleted: ${deleteResult.deletedCount === 1 ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('Error testing email verification:', error);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  testEmailVerification().catch(console.error);
}

module.exports = { testEmailVerification };
