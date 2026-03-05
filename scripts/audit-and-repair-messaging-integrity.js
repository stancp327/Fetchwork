const mongoose = require('../server/node_modules/mongoose');
const User = require('../server/models/User');
const { Conversation, Message, ReceiptCursor } = require('../server/models/Message');

const uri = 'mongodb+srv://Fetchwork_user:D2ze96Jy9SFAr4HbR@fetchwork.sch7kdf.mongodb.net/fetchwork';

const DRY_RUN = false;
const CANONICAL_STANFORD = '6882fb8492236647be94dc15';
const SECONDARY_STANFORD = '688484275951f01b86a6be0c';

function pairKey(participants) {
  return [...participants.map(String)].sort().join('|');
}

(async () => {
  await mongoose.connect(uri);

  const report = {
    duplicateUsersByName: [],
    oldStanfordRefs: {},
    duplicateConversationPairs: [],
    repairedPairs: [],
    deactivatedUsers: [],
  };

  // 1) Audit duplicate display-name users (informational)
  const users = await User.find({ isActive: true }).select('_id firstName lastName email createdAt').lean();
  const byName = new Map();
  for (const u of users) {
    const k = `${(u.firstName || '').trim().toLowerCase()}|${(u.lastName || '').trim().toLowerCase()}`;
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(u);
  }
  for (const [k, arr] of byName.entries()) {
    if (arr.length > 1) {
      report.duplicateUsersByName.push({
        nameKey: k,
        count: arr.length,
        users: arr.map((u) => ({ id: String(u._id), email: u.email, createdAt: u.createdAt })),
      });
    }
  }

  // 2) Ensure all messaging refs are on canonical Stanford
  const oldObj = new mongoose.Types.ObjectId(SECONDARY_STANFORD);
  const canonicalObj = new mongoose.Types.ObjectId(CANONICAL_STANFORD);

  const convosWithSecondary = await Conversation.countDocuments({ participants: oldObj });
  const msgSenderSecondary = await Message.countDocuments({ sender: oldObj });
  const msgRecipientSecondary = await Message.countDocuments({ recipient: oldObj });
  const cursorSecondary = await ReceiptCursor.countDocuments({ userId: oldObj });

  report.oldStanfordRefs = { convosWithSecondary, msgSenderSecondary, msgRecipientSecondary, cursorSecondary };

  if (!DRY_RUN && (convosWithSecondary || msgSenderSecondary || msgRecipientSecondary || cursorSecondary)) {
    const convos = await Conversation.find({ participants: oldObj }).select('_id participants').lean();
    for (const convo of convos) {
      const next = [...new Set((convo.participants || []).map((p) => String(p) === SECONDARY_STANFORD ? CANONICAL_STANFORD : String(p)))];
      await Conversation.updateOne({ _id: convo._id }, { $set: { participants: next.map((id) => new mongoose.Types.ObjectId(id)) } });
    }

    await Message.updateMany({ sender: oldObj }, { $set: { sender: canonicalObj } });
    await Message.updateMany({ recipient: oldObj }, { $set: { recipient: canonicalObj } });

    const convoIds = convos.map((c) => c._id);
    if (convoIds.length) {
      await ReceiptCursor.deleteMany({ userId: canonicalObj, conversationId: { $in: convoIds } });
    }
    await ReceiptCursor.updateMany({ userId: oldObj }, { $set: { userId: canonicalObj } });
  }

  // 3) Find duplicate direct-message conversation pairs and merge them
  const allConvos = await Conversation.find({ isActive: true }).select('_id participants lastActivity lastMessage lastMessageSeq lastMessageAt').lean();
  const pairMap = new Map();

  for (const c of allConvos) {
    const p = (c.participants || []).map(String);
    if (p.length !== 2) continue; // direct message only
    const key = pairKey(p);
    if (!pairMap.has(key)) pairMap.set(key, []);
    pairMap.get(key).push(c);
  }

  for (const [key, convos] of pairMap.entries()) {
    if (convos.length <= 1) continue;

    convos.sort((a, b) => new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0));
    const keep = convos[0];
    const drop = convos.slice(1);

    report.duplicateConversationPairs.push({ key, keep: String(keep._id), drop: drop.map((d) => String(d._id)) });

    if (DRY_RUN) continue;

    let maxSeq = Number(keep.lastMessageSeq || 0);

    for (const d of drop) {
      const moved = await Message.find({ conversation: d._id }).sort({ seq: 1, createdAt: 1 }).lean();
      for (const m of moved) {
        maxSeq += 1;
        await Message.updateOne(
          { _id: m._id },
          { $set: { conversation: keep._id, seq: maxSeq } }
        );
      }

      const cursors = await ReceiptCursor.find({ conversationId: d._id }).lean();
      for (const c of cursors) {
        await ReceiptCursor.updateOne(
          { conversationId: keep._id, userId: c.userId },
          {
            $max: {
              lastReadSeq: Number(c.lastReadSeq || 0),
              lastDeliveredSeq: Number(c.lastDeliveredSeq || 0),
            },
          },
          { upsert: true }
        );
      }
      await ReceiptCursor.deleteMany({ conversationId: d._id });
      await Conversation.deleteOne({ _id: d._id });
    }

    const lastMsg = await Message.findOne({ conversation: keep._id }).sort({ seq: -1, createdAt: -1 }).select('_id seq createdAt').lean();
    await Conversation.updateOne(
      { _id: keep._id },
      {
        $set: {
          lastMessage: lastMsg?._id || null,
          lastMessageSeq: Number(lastMsg?.seq || maxSeq || 0),
          lastMessageAt: lastMsg?.createdAt || keep.lastMessageAt || new Date(),
          lastActivity: lastMsg?.createdAt || keep.lastActivity || new Date(),
        },
      }
    );

    report.repairedPairs.push({ key, kept: String(keep._id), removed: drop.map((d) => String(d._id)) });
  }

  // 4) Deactivate secondary Stanford account to prevent re-splitting
  if (!DRY_RUN) {
    const secondaryUser = await User.findById(SECONDARY_STANFORD).select('_id isActive').lean();
    if (secondaryUser && secondaryUser.isActive) {
      await User.updateOne(
        { _id: SECONDARY_STANFORD },
        {
          $set: {
            isActive: false,
            isSuspended: true,
            suspensionReason: 'Merged into canonical account for messaging integrity',
          },
        }
      );
      report.deactivatedUsers.push(SECONDARY_STANFORD);
    }
  }

  // 5) Final counts
  report.final = {
    secondaryRefs: {
      convos: await Conversation.countDocuments({ participants: oldObj }),
      sender: await Message.countDocuments({ sender: oldObj }),
      recipient: await Message.countDocuments({ recipient: oldObj }),
      cursor: await ReceiptCursor.countDocuments({ userId: oldObj }),
    },
    duplicatePairsRemaining: (await Conversation.aggregate([
      { $match: { isActive: true } },
      { $project: { participants: 1 } },
      { $match: { $expr: { $eq: [{ $size: '$participants' }, 2] } } },
      { $project: { pair: { $sortArray: { input: '$participants', sortBy: 1 } } } },
      { $group: { _id: '$pair', c: { $sum: 1 } } },
      { $match: { c: { $gt: 1 } } },
      { $count: 'n' },
    ]))[0]?.n || 0,
  };

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
})();
