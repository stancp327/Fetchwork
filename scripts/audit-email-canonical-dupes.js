const mongoose = require('../server/node_modules/mongoose');

(async () => {
  await mongoose.connect('mongodb+srv://Fetchwork_user:D2ze96Jy9SFAr4HbR@fetchwork.sch7kdf.mongodb.net/fetchwork');
  const db = mongoose.connection.db;
  const dupes = await db.collection('users').aggregate([
    { $group: { _id: '$emailCanonical', ids: { $push: '$_id' }, c: { $sum: 1 } } },
    { $match: { c: { $gt: 1 } } }
  ]).toArray();
  console.log(JSON.stringify({ dupes }, null, 2));
  await mongoose.disconnect();
})();
