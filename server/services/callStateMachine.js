const ALLOWED = {
  created: ['invited', 'ringing', 'canceled', 'failed'],
  invited: ['ringing', 'canceled', 'timed_out', 'failed'],
  ringing: ['accepted', 'declined', 'missed', 'timed_out', 'canceled', 'failed'],
  accepted: ['connecting', 'ended', 'failed'],
  connecting: ['connected', 'failed', 'timed_out', 'ended'],
  connected: ['ending', 'ended', 'failed'],
  ending: ['ended'],

  // legacy state mapping
  active: ['ending', 'ended', 'failed'],

  // terminal
  ended: [],
  declined: [],
  missed: [],
  canceled: [],
  failed: [],
  timed_out: [],
  fraud_blocked: [],
  rejected: [],
};

const TERMINAL = new Set(['ended', 'declined', 'missed', 'canceled', 'failed', 'timed_out', 'fraud_blocked', 'rejected']);

function canTransition(from, to) {
  if (!from) return true;
  if (from === to) return true;
  return (ALLOWED[from] || []).includes(to);
}

function updateParticipant(call, userId, patch) {
  if (!userId) return;
  const p = call.participants?.find((x) => x.userId?.toString() === userId.toString());
  if (p) Object.assign(p, patch);
}

async function transitionCall(call, to, { actorId, reason } = {}) {
  const from = call.status;
  if (!canTransition(from, to)) {
    const err = new Error(`Invalid call transition: ${from} -> ${to}`);
    err.code = 'ERR_INVALID_STATE_TRANSITION';
    throw err;
  }

  call.status = to;
  call.version = (call.version || 0) + 1;
  if (reason) call.endReason = reason;

  if (to === 'accepted') {
    updateParticipant(call, call.recipient, { state: 'accepted' });
  }
  if (to === 'connecting') {
    updateParticipant(call, call.caller, { state: 'connecting' });
    updateParticipant(call, call.recipient, { state: 'connecting' });
  }
  if (to === 'connected' || to === 'active') {
    if (!call.startedAt) call.startedAt = new Date();
    updateParticipant(call, call.caller, { state: 'connected', joinedAt: call.startedAt });
    updateParticipant(call, call.recipient, { state: 'connected', joinedAt: call.startedAt });
  }

  if (TERMINAL.has(to) || to === 'ended') {
    const now = new Date();
    if (!call.endedAt) call.endedAt = now;
    if (call.startedAt && !call.duration) {
      call.duration = Math.max(0, Math.round((call.endedAt - call.startedAt) / 1000));
    }
    if (actorId) {
      const actorRole = call.caller.toString() === actorId.toString() ? 'caller' : 'recipient';
      updateParticipant(call, actorRole === 'caller' ? call.caller : call.recipient, {
        state: 'left',
        leftAt: now,
        disconnectReason: reason || to,
      });
    }
  }

  await call.save();
  return call;
}

module.exports = { canTransition, transitionCall, TERMINAL };
