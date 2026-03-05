const mongoose = require('../server/node_modules/mongoose');
const User = require('../server/models/User');
const { canonicalizeEmail } = require('../server/utils/authIdentity');

(async () => {
  await mongoose.connect('mongodb+srv://Fetchwork_user:D2ze96Jy9SFAr4HbR@fetchwork.sch7kdf.mongodb.net/fetchwork');

  const users = await User.find({}).select('_id email emailCanonical').lean();
  let updated = 0;
  for (const u of users) {
    const normalized = canonicalizeEmail(u.email);
    if (!normalized) continue;
    if (u.emailCanonical !== normalized) {
      await User.updateOne({ _id: u._id }, { $set: { emailCanonical: normalized, email: normalized } });
      updated++;
    }
  }

  await User.collection.createIndex({ emailCanonical: 1 }, { unique: true, name: 'uniq_email_canonical' });
  await User.collection.createIndex({ googleId: 1 }, { unique: true, sparse: true, name: 'uniq_google_id' });

  console.log(JSON.stringify({ ok: true, usersScanned: users.length, updated }, null, 2));
  await mongoose.disconnect();
})();
