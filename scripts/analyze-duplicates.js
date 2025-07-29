const { MongoClient } = require('mongodb');

async function analyzeDuplicates() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI environment variable is required');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const usersCollection = db.collection('users');
    
    console.log('\n=== DUPLICATE EMAIL ANALYSIS ===\n');
    
    const duplicateEmails = await usersCollection.aggregate([
      {
        $group: {
          _id: "$email",
          count: { $sum: 1 },
          users: { $push: "$$ROOT" }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]).toArray();
    
    if (duplicateEmails.length === 0) {
      console.log('✅ No duplicate email addresses found');
      return;
    }
    
    console.log(`Found ${duplicateEmails.length} email(s) with duplicates:\n`);
    
    for (const emailGroup of duplicateEmails) {
      console.log(`📧 Email: ${emailGroup._id} (${emailGroup.count} accounts)`);
      console.log('─'.repeat(60));
      
      emailGroup.users.forEach((user, index) => {
        console.log(`Account ${index + 1}:`);
        console.log(`  ID: ${user._id}`);
        console.log(`  Created: ${user.createdAt}`);
        console.log(`  Verified: ${user.isVerified || false}`);
        console.log(`  Admin Promoted: ${user.isAdminPromoted || false}`);
        console.log(`  First Name: ${user.firstName || 'N/A'}`);
        console.log(`  Last Name: ${user.lastName || 'N/A'}`);
        console.log(`  Account Type: ${user.accountType || 'N/A'}`);
        console.log(`  Profile Complete: ${user.profileComplete || false}`);
        console.log(`  Has Password: ${!!user.password}`);
        console.log(`  Providers: ${user.providers ? user.providers.join(', ') : 'email'}`);
        
        const completenessScore = calculateCompletenessScore(user);
        console.log(`  Completeness Score: ${completenessScore}/10`);
        console.log('');
      });
      
      const recommendedAccount = recommendPrimaryAccount(emailGroup.users);
      console.log(`🎯 RECOMMENDED PRIMARY: Account ${emailGroup.users.indexOf(recommendedAccount) + 1} (ID: ${recommendedAccount._id})`);
      console.log(`   Reason: ${getRecommendationReason(recommendedAccount, emailGroup.users)}`);
      console.log('\n' + '='.repeat(80) + '\n');
    }
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total duplicate email groups: ${duplicateEmails.length}`);
    console.log(`Total duplicate accounts: ${duplicateEmails.reduce((sum, group) => sum + group.count, 0)}`);
    console.log(`Accounts to be removed: ${duplicateEmails.reduce((sum, group) => sum + group.count - 1, 0)}`);
    
  } catch (error) {
    console.error('Error analyzing duplicates:', error);
  } finally {
    await client.close();
  }
}

function calculateCompletenessScore(user) {
  let score = 0;
  
  if (user.firstName) score += 1;
  if (user.lastName) score += 1;
  if (user.isVerified) score += 2;
  if (user.profileComplete) score += 2;
  if (user.password) score += 1;
  if (user.accountType) score += 1;
  if (user.isAdminPromoted) score += 2;
  
  return score;
}

function recommendPrimaryAccount(users) {
  return users.reduce((best, current) => {
    const bestScore = calculateCompletenessScore(best);
    const currentScore = calculateCompletenessScore(current);
    
    if (currentScore > bestScore) return current;
    if (currentScore < bestScore) return best;
    
    if (current.isAdminPromoted && !best.isAdminPromoted) return current;
    if (best.isAdminPromoted && !current.isAdminPromoted) return best;
    
    if (current.isVerified && !best.isVerified) return current;
    if (best.isVerified && !current.isVerified) return best;
    
    return new Date(current.createdAt) > new Date(best.createdAt) ? current : best;
  });
}

function getRecommendationReason(recommended, allUsers) {
  const reasons = [];
  
  if (recommended.isAdminPromoted) {
    reasons.push('has admin privileges');
  }
  
  const recommendedScore = calculateCompletenessScore(recommended);
  const maxScore = Math.max(...allUsers.map(calculateCompletenessScore));
  
  if (recommendedScore === maxScore) {
    reasons.push('highest completeness score');
  }
  
  if (recommended.isVerified) {
    reasons.push('email verified');
  }
  
  const latestCreated = allUsers.reduce((latest, user) => 
    new Date(user.createdAt) > new Date(latest.createdAt) ? user : latest
  );
  
  if (recommended._id.toString() === latestCreated._id.toString()) {
    reasons.push('most recently created');
  }
  
  return reasons.length > 0 ? reasons.join(', ') : 'default selection';
}

if (require.main === module) {
  analyzeDuplicates().catch(console.error);
}

module.exports = { analyzeDuplicates };
