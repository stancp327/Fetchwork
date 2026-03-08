#!/usr/bin/env node
/**
 * TURN Allocate Test Script
 * Sends a real TURN Allocate request (with HMAC-SHA1 REST-auth-secret credentials)
 * and verifies the server actually accepts them — not just a port check.
 *
 * Usage:
 *   node server/scripts/test-turn.js
 *   TURN_AUTH_SECRET=xxx TURN_URLS=turn:host:port node server/scripts/test-turn.js
 *
 * Requires Node 18+ (uses built-in crypto + net)
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const net = require('net');
const crypto = require('crypto');

// ── Config ──────────────────────────────────────────────────────
const TURN_AUTH_SECRET = process.env.TURN_AUTH_SECRET;
const TURN_URLS_RAW    = process.env.TURN_URLS || '';
const TEST_USER_ID     = 'testuser123';

if (!TURN_AUTH_SECRET) {
  console.error('❌  TURN_AUTH_SECRET is not set');
  process.exit(1);
}
if (!TURN_URLS_RAW) {
  console.error('❌  TURN_URLS is not set');
  process.exit(1);
}

// ── STUN/TURN message helpers ───────────────────────────────────
const MAGIC_COOKIE = 0x2112A442;

function randomTransactionId() {
  return crypto.randomBytes(12);
}

function buildAllocateRequest(transactionId, attrs = []) {
  // Calculate attributes length
  let attrsLen = 0;
  for (const a of attrs) attrsLen += 4 + a.value.length;

  const msg = Buffer.alloc(20 + attrsLen);
  msg.writeUInt16BE(0x0003, 0); // TURN Allocate
  msg.writeUInt16BE(attrsLen, 2);
  msg.writeUInt32BE(MAGIC_COOKIE, 4);
  transactionId.copy(msg, 8);

  let offset = 20;
  for (const a of attrs) {
    msg.writeUInt16BE(a.type, offset); offset += 2;
    msg.writeUInt16BE(a.value.length, offset); offset += 2;
    a.value.copy(msg, offset); offset += a.value.length;
    // Pad to 4-byte boundary
    const pad = (4 - (a.value.length % 4)) % 4;
    offset += pad;
  }
  return msg;
}

function parseMessage(buf) {
  if (buf.length < 20) return null;
  const type   = buf.readUInt16BE(0);
  const len    = buf.readUInt16BE(2);
  const cookie = buf.readUInt32BE(4);
  const txId   = buf.slice(8, 20).toString('hex');
  const attrs  = {};

  if (cookie !== MAGIC_COOKIE) return { type, len, txId, attrs, raw: buf };

  let offset = 20;
  while (offset < 20 + len) {
    const aType = buf.readUInt16BE(offset); offset += 2;
    const aLen  = buf.readUInt16BE(offset); offset += 2;
    const aVal  = buf.slice(offset, offset + aLen);
    const pad   = (4 - (aLen % 4)) % 4;
    offset += aLen + pad;

    if (aType === 0x0014) attrs.REALM = aVal.toString('utf8').replace(/\0/g,'');
    if (aType === 0x0015) attrs.NONCE = aVal;
    if (aType === 0x0009) {
      attrs.ERROR_CODE = {
        code: ((aVal[2] & 0x07) * 100) + aVal[3],
        reason: aVal.slice(4).toString('utf8'),
      };
    }
    if (aType === 0x0016) attrs.RELAY_ADDRESS = aVal;
  }
  return { type, len, txId, attrs };
}

// Compute MESSAGE-INTEGRITY for long-term credentials
// key = MD5(username:realm:password)
function messageIntegrity(msgBuf, key) {
  // HMAC-SHA1 over the message up to (but not including) the MI attribute
  return crypto.createHmac('sha1', key).update(msgBuf).digest();
}

// ── Generate credentials ────────────────────────────────────────
function generateCredentials(secret, userId) {
  const expiresAt = Math.floor(Date.now() / 1000) + 86400;
  const username  = `${expiresAt}:${userId}`;
  const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');
  return { username, credential, expiresAt };
}

// ── Parse TURN URL ──────────────────────────────────────────────
function parseTurnUrl(url) {
  // Supports: turn:host:port?transport=tcp|udp  OR  turn:host?transport=...
  const m = url.match(/^turns?:([^:?]+)(?::(\d+))?(?:\?transport=(\w+))?/);
  if (!m) return null;
  return {
    host:      m[1],
    port:      parseInt(m[2] || '3478', 10),
    transport: (m[3] || 'udp').toLowerCase(),
    tls:       url.startsWith('turns:'),
  };
}

// ── Test a single TURN server (TCP Allocate flow) ───────────────
function testTurnServer(host, port, username, credential) {
  return new Promise((resolve) => {
    const password = credential; // base64 HMAC — treat as password
    const realm    = null; // will be filled from 401
    const txId1    = randomTransactionId();
    const txId2    = randomTransactionId();

    let step = 1;
    let buf  = Buffer.alloc(0);
    let resolved = false;

    const done = (result) => {
      if (resolved) return;
      resolved = true;
      client.destroy();
      resolve(result);
    };

    const client = net.createConnection({ host, port, timeout: 5000 });

    client.on('timeout', () => done({ ok: false, error: 'TCP connection timeout' }));
    client.on('error',   (e) => done({ ok: false, error: e.message }));

    client.on('connect', () => {
      // Step 1: send unauthenticated Allocate to get realm+nonce
      const msg = buildAllocateRequest(txId1);
      client.write(msg);
    });

    client.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (buf.length < 4) return;
      const msgLen = buf.readUInt16BE(2);
      if (buf.length < 20 + msgLen) return; // wait for full message

      const parsed = parseMessage(buf);
      buf = buf.slice(20 + msgLen); // consume

      if (!parsed) return done({ ok: false, error: 'Could not parse TURN response' });

      if (step === 1) {
        // Expect 401 Unauthorized with REALM + NONCE
        if (parsed.type !== 0x0113) {
          return done({ ok: false, error: `Expected 401 (0x0113) got 0x${parsed.type.toString(16)}` });
        }
        if (!parsed.attrs.REALM || !parsed.attrs.NONCE) {
          return done({ ok: false, error: '401 received but missing REALM or NONCE — server may not be in REST-auth mode' });
        }

        const realmStr  = parsed.attrs.REALM;
        const nonceVal  = parsed.attrs.NONCE;

        // Compute long-term credential key: MD5(username:realm:password)
        const key = crypto.createHash('md5')
          .update(`${username}:${realmStr}:${password}`)
          .digest();

        // Build attrs for authenticated request
        const usernameAttr = {
          type:  0x0006,
          value: Buffer.from(username, 'utf8'),
        };
        // Pad username to 4-byte boundary
        const uPad = (4 - (usernameAttr.value.length % 4)) % 4;
        if (uPad) usernameAttr.value = Buffer.concat([usernameAttr.value, Buffer.alloc(uPad)]);

        const realmAttr = {
          type:  0x0014,
          value: Buffer.from(realmStr + '\x00', 'utf8'),
        };
        const rPad = (4 - (realmAttr.value.length % 4)) % 4;
        if (rPad) realmAttr.value = Buffer.concat([realmAttr.value, Buffer.alloc(rPad)]);

        const nonceAttr = { type: 0x0015, value: nonceVal };
        const nPad = (4 - (nonceVal.length % 4)) % 4;
        if (nPad) nonceAttr.value = Buffer.concat([nonceAttr.value, Buffer.alloc(nPad)]);

        // Build message WITHOUT message-integrity first to compute HMAC
        const preMsgAttrs = [usernameAttr, realmAttr, nonceAttr];
        let preMsgLen = 0;
        for (const a of preMsgAttrs) preMsgLen += 4 + a.value.length;
        preMsgLen += 4 + 20; // placeholder for MESSAGE-INTEGRITY

        const preMsg = Buffer.alloc(20 + preMsgLen);
        preMsg.writeUInt16BE(0x0003, 0);
        preMsg.writeUInt16BE(preMsgLen, 2);
        preMsg.writeUInt32BE(MAGIC_COOKIE, 4);
        txId2.copy(preMsg, 8);
        let off = 20;
        for (const a of preMsgAttrs) {
          preMsg.writeUInt16BE(a.type, off); off += 2;
          preMsg.writeUInt16BE(a.value.length, off); off += 2;
          a.value.copy(preMsg, off); off += a.value.length;
        }
        // Write MI placeholder
        preMsg.writeUInt16BE(0x0008, off); off += 2;
        preMsg.writeUInt16BE(20, off); off += 2; // SHA1 = 20 bytes

        // Compute HMAC over message up to (not including) MI value
        const hmac = messageIntegrity(preMsg.slice(0, off), key);
        hmac.copy(preMsg, off);

        step = 2;
        client.write(preMsg);

      } else if (step === 2) {
        if (parsed.type === 0x0103) {
          // Success: Allocate Response
          return done({ ok: true, relayAddress: parsed.attrs.RELAY_ADDRESS ? 'present' : 'unknown' });
        } else if (parsed.type === 0x0113 && parsed.attrs.ERROR_CODE) {
          const e = parsed.attrs.ERROR_CODE;
          return done({ ok: false, error: `Auth failed — ${e.code} ${e.reason}. Check TURN_AUTH_SECRET matches coturn static-auth-secret` });
        } else {
          return done({ ok: false, error: `Unexpected response type: 0x${parsed.type.toString(16)}` });
        }
      }
    });
  });
}

// ── Main ────────────────────────────────────────────────────────
async function main() {
  console.log('🔍  TURN Server Diagnostic\n');

  const creds = generateCredentials(TURN_AUTH_SECRET, TEST_USER_ID);
  console.log(`📋  Generated credentials:`);
  console.log(`    username:   ${creds.username}`);
  console.log(`    credential: ${creds.credential}`);
  console.log(`    expires:    ${new Date(creds.expiresAt * 1000).toISOString()}\n`);

  const urls = TURN_URLS_RAW.split(',').map(u => u.trim()).filter(Boolean);
  if (!urls.length) {
    console.error('❌  No TURN URLs parsed from TURN_URLS');
    process.exit(1);
  }

  let anyPass = false;

  for (const url of urls) {
    const parsed = parseTurnUrl(url);
    if (!parsed) {
      console.log(`⚠️   Could not parse URL: ${url}`);
      continue;
    }

    process.stdout.write(`🧪  Testing ${url} (${parsed.host}:${parsed.port} ${parsed.transport.toUpperCase()}) ... `);

    if (parsed.tls) {
      console.log('SKIPPED (TLS not supported in this script, test manually)');
      continue;
    }

    const result = await testTurnServer(parsed.host, parsed.port, creds.username, creds.credential);
    if (result.ok) {
      console.log('✅  PASS — Allocate succeeded, credentials accepted');
      anyPass = true;
    } else {
      console.log(`❌  FAIL — ${result.error}`);
    }
  }

  console.log('');
  if (anyPass) {
    console.log('✅  TURN server is working. If calls still fail, check:');
    console.log('    • Relay port range 49152-65535 UDP open in firewall');
    console.log('    • coturn external-ip set correctly if behind NAT');
    console.log('    • Add turns: entry to TURN_URLS for TLS on port 443/5349');
  } else {
    console.log('❌  TURN server test failed. Check:');
    console.log('    • coturn running with --use-auth-secret or static-auth-secret=xxx');
    console.log('    • TURN_AUTH_SECRET matches coturn config exactly');
    console.log('    • No whitespace/newlines in the secret');
    console.log('    • lt-cred-mech and use-auth-secret not both enabled (conflict)');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
