const mongoose = require('mongoose');

async function main() {
  const uri = 'mongodb+srv://Fetchwork_user:D2ze96Jy9SFAr4HbR@fetchwork.sch7kdf.mongodb.net/fetchwork';
  await mongoose.connect(uri);

  const db = mongoose.connection.db;
  const email = 'stancp327@gmail.com';

  const user = await db.collection('users').findOne(
    { email },
    { projection: { _id: 1, teams: 1, email: 1 } }
  );

  if (!user) {
    console.log('USER_NOT_FOUND');
    await mongoose.disconnect();
    return;
  }

  const teams = await db.collection('teams')
    .find({ owner: user._id, isActive: true })
    .project({ _id: 1, name: 1 })
    .toArray();

  if (!teams.length) {
    console.log('NO_ACTIVE_TEAMS');
    await mongoose.disconnect();
    return;
  }

  const teamIds = teams.map((t) => t._id);

  await db.collection('teams').updateMany(
    { _id: { $in: teamIds } },
    { $set: { isActive: false, updatedAt: new Date() } }
  );

  await db.collection('users').updateOne(
    { _id: user._id },
    { $pull: { teams: { $in: teamIds } } }
  );

  await db.collection('users').updateMany(
    { _id: { $ne: user._id }, teams: { $in: teamIds } },
    { $pull: { teams: { $in: teamIds } } }
  );

  console.log('DELETED_TEAMS', teams.length);
  for (const t of teams) {
    console.log('-', String(t._id), t.name);
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
