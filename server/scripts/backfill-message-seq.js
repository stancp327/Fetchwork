const mongoose = require('mongoose');
const { Conversation, Message } = require('../models/Message');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://Fetchwork_user:D2ze96Jy9SFAr4HbR@fetchwork.sch7kdf.mongodb.net/fetchwork';
  await mongoose.connect(uri);

  const conversations = await Conversation.find({}).select('_id').lean();
  let convUpdated = 0;
  let msgUpdated = 0;

  for (const c of conversations) {
    const msgs = await Message.find({ conversation: c._id, isDeleted: { $ne: true } })
      .sort({ createdAt: 1, _id: 1 })
      .select('_id seq createdAt')
      .lean();

    if (!msgs.length) {
      await Conversation.updateOne(
        { _id: c._id },
        { $set: { seq: 0, lastMessageSeq: 0 }, $unset: { lastMessageAt: '' } }
      );
      convUpdated += 1;
      continue;
    }

    let seq = 0;
    const tempBulk = [];
    const finalBulk = [];
    for (let i = 0; i < msgs.length; i += 1) {
      const m = msgs[i];
      seq = i + 1;
      // Two-phase update avoids unique index collisions on (conversation, seq)
      tempBulk.push({
        updateOne: {
          filter: { _id: m._id },
          update: { $set: { seq: -(seq + 1000000) } },
        },
      });
      finalBulk.push({
        updateOne: {
          filter: { _id: m._id },
          update: { $set: { seq } },
        },
      });
    }

    if (tempBulk.length) {
      await Message.bulkWrite(tempBulk, { ordered: true });
      const res = await Message.bulkWrite(finalBulk, { ordered: true });
      msgUpdated += (res.modifiedCount || 0);
    }

    const last = msgs[msgs.length - 1];
    await Conversation.updateOne(
      { _id: c._id },
      {
        $set: {
          seq,
          lastMessageSeq: seq,
          lastMessage: last._id,
          lastMessageAt: last.createdAt,
        },
      }
    );
    convUpdated += 1;
  }

  console.log(JSON.stringify({ conversationsProcessed: conversations.length, conversationsUpdated: convUpdated, messagesUpdated: msgUpdated }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Backfill failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
