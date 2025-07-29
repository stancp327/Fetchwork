const { MongoClient, ServerApiVersion } = require('mongodb');

async function cleanupDuplicates(dryRun = true) {
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
    
    console.log(`\n=== DUPLICATE CLEANUP ${dryRun ? '(DRY RUN)' : '(LIVE RUN)'} ===\n`);
    
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
      }
    ]).toArray();
    
    if (duplicateEmails.length === 0) {
      console.log('✅ No duplicate email addresses found');
      return;
    }
    
    const cleanupLog = [];
    let totalRemoved = 0;
    
    for (const emailGroup of duplicateEmails) {
      console.log(`\n📧 Processing: ${emailGroup._id} (${emailGroup.count} accounts)`);
      
      const primaryAccount = recommendPrimaryAccount(emailGroup.users);
      const duplicateAccounts = emailGroup.users.filter(user => 
        user._id.toString() !== primaryAccount._id.toString()
      );
      
      console.log(`   Keeping: ${primaryAccount._id} (${getRecommendationReason(primaryAccount, emailGroup.users)})`);
      console.log(`   Removing: ${duplicateAccounts.length} account(s)`);
      
      for (const duplicate of duplicateAccounts) {
        console.log(`     - ${duplicate._id} (created: ${duplicate.createdAt})`);
        
        if (!dryRun) {
          try {
            await mergeAccountData(usersCollection, duplicate, primaryAccount);
            
            const deleteResult = await usersCollection.deleteOne({ _id: duplicate._id });
            if (deleteResult.deletedCount === 1) {
              console.log(`       ✅ Deleted successfully`);
              totalRemoved++;
            } else {
              console.log(`       ❌ Failed to delete`);
            }
          } catch (error) {
            console.error(`       ❌ Error processing duplicate ${duplicate._id}:`, error.message);
          }
        }
        
        cleanupLog.push({
          email: emailGroup._id,
          removedId: duplicate._id.toString(),
          keptId: primaryAccount._id.toString(),
          timestamp: new Date().toISOString()
        });
      }
    }
    
    if (!dryRun) {
      await db.collection('cleanup_logs').insertOne({
        operation: 'duplicate_cleanup',
        timestamp: new Date(),
        removedAccounts: totalRemoved,
        details: cleanupLog
      });
    }
    
    console.log(`\n=== CLEANUP SUMMARY ===`);
    console.log(`Duplicate email groups processed: ${duplicateEmails.length}`);
    console.log(`Accounts ${dryRun ? 'would be' : 'were'} removed: ${cleanupLog.length}`);
    
    if (dryRun) {
      console.log('\n⚠️  This was a DRY RUN. No changes were made.');
      console.log('Run with --live flag to perform actual cleanup.');
    } else {
      console.log('\n✅ Cleanup completed successfully.');
    }
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await client.close();
  }
}

async function mergeAccountData(usersCollection, sourceAccount, targetAccount) {
  const updates = {};
  
  if (!targetAccount.firstName && sourceAccount.firstName) {
    updates.firstName = sourceAccount.firstName;
  }
  
  if (!targetAccount.lastName && sourceAccount.lastName) {
    updates.lastName = sourceAccount.lastName;
  }
  
  if (!targetAccount.profileComplete && sourceAccount.profileComplete) {
    updates.profileComplete = sourceAccount.profileComplete;
  }
  
  if (sourceAccount.providers && sourceAccount.providers.length > 0) {
    const existingProviders = targetAccount.providers || ['email'];
    const newProviders = [...new Set([...existingProviders, ...sourceAccount.providers])];
    if (newProviders.length > existingProviders.length) {
      updates.providers = newProviders;
    }
  }
  
  if (Object.keys(updates).length > 0) {
    await usersCollection.updateOne(
      { _id: targetAccount._id },
      { $set: updates }
    );
    console.log(`       📝 Merged data: ${Object.keys(updates).join(', ')}`);
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
  const isLive = process.argv.includes('--live');
  cleanupDuplicates(!isLive).catch(console.error);
}

module.exports = { cleanupDuplicates };
