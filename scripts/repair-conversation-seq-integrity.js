const mongoose = require('../server/node_modules/mongoose');
const { Conversation, Message } = require('../server/models/Message');

(async () => {
  await mongoose.connect('mongodb+srv://Fetchwork_user:D2ze96Jy9SFAr4HbR@fetchwork.sch7kdf.mongodb.net/fetchwork');

  const convos = await Conversation.find({ isActive: true }).select('_id seq lastMessageSeq').lean();
  const repairs = [];

  for (const c of convos) {
    const maxMsg = await Message.findOne({ conversation: c._id }).sort({ seq: -1 }).select('seq _id createdAt').lean();
    const maxSeq = Number(maxMsg?.seq || 0);
    const currentSeq = Number(c.seq || 0);
    const currentLast = Number(c.lastMessageSeq || 0);

    const targetSeq = Math.max(currentSeq, currentLast, maxSeq);

    if (targetSeq !== currentSeq || currentLast !== maxSeq) {
      await Conversation.updateOne(
        { _id: c._id },
        {
          $set: {
            seq: targetSeq,
            lastMessageSeq: Math.max(currentLast, maxSeq),
          },
        }
      );
      repairs.push({ id: String(c._id), seqFrom: currentSeq, seqTo: targetSeq, lastFrom: currentLast, maxSeq });
    }
  }

  console.log(JSON.stringify({ scanned: convos.length, repaired: repairs.length, repairs }, null, 2));
  await mongoose.disconnect();
})();
