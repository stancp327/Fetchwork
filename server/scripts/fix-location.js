const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://Fetchwork_user:D2ze96Jy9SFAr4HbR@fetchwork.sch7kdf.mongodb.net/fetchwork').then(async () => {
  const result = await mongoose.connection.db.collection('users').updateMany(
    { $or: [{ location: '' }, { location: null }, { location: { $type: 'string' } }] },
    { $set: { location: { locationType: 'remote', city: '', state: '', zipCode: '', coordinates: { type: 'Point', coordinates: [0, 0] }, serviceRadius: 25 } } }
  );
  console.log('Fixed', result.modifiedCount, 'users with bad location data');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
