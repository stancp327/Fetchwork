#!/usr/bin/env node
/**
 * Standalone TURN diagnostics script.
 * Run: node server/scripts/test-turn.js
 */
const path = require('path');
const crypto = require('crypto');
const net = require('net');
const fs = require('fs');

// Load .env.local first, then .env
const root = path.resolve(__dirname, '../..');
for (const f of ['.env.local', '.env']) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) {
    require('dotenv').config({ path: p });
  }
}

const secret = process.env.TURN_AUTH_SECRET || '';
const urlsRaw = process.env.TURN_URLS || '';
const turnUrls = urlsRaw.split(',').map(u => u.trim()).filter(Boolean);
const ttl = Number(process.env.TURN_TTL_SECONDS || 86400);

console.log('\n=== TURN Diagnostics ===\n');

// 1. Config check
const results = [];

const configOk = !!secret && turnUrls.length > 0;
results.push({ label: 'TURN_AUTH_SECRET set', pass: !!secret });
results.push({ label: 'TURN_URLS set', pass: turnUrls.length > 0 });
results.push({ label: `TTL = ${ttl}s`, pass: ttl > 0 });

if (turnUrls.length) {
  console.log('TURN URLs:', turnUrls.join(', '));
}

// 2. Generate sample HMAC credentials
const expiresAt = Math.floor(Date.now() / 1000) + ttl;
const username = `${expiresAt}:testUser:testCall`;
const credential = secret
  ? crypto.createHmac('sha1', secret).update(username).digest('base64')
  : '(no secret)';

console.log(`\nSample credentials:`);
console.log(`  username:   ${username}`);
console.log(`  credential: ${credential}`);
results.push({ label: 'HMAC credential generated', pass: !!secret });

// 3. TCP reachability
const parseTurnUrl = (url) => {
  const m = url.match(/^turns?:([^:?]+):(\d+)/);
  if (m) return { host: m[1], port: parseInt(m[2], 10) };
  const m2 = url.match(/^turns?:([^:?]+)/);
  if (m2) return { host: m2[1], port: url.startsWith('turns:') ? 5349 : 3478 };
  return null;
};

const checkTcp = (host, port) =>
  new Promise((resolve) => {
    const sock = net.createConnection({ host, port, timeout: 3000 }, () => {
      sock.destroy();
      resolve(true);
    });
    sock.on('error', () => { sock.destroy(); resolve(false); });
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
  });

(async () => {
  if (turnUrls.length === 0) {
    console.log('\nNo TURN URLs to test reachability.\n');
  } else {
    console.log('\nTCP reachability:');
    for (const url of turnUrls) {
      const parsed = parseTurnUrl(url);
      if (!parsed) {
        console.log(`  ${url} — could not parse`);
        results.push({ label: `TCP ${url}`, pass: false });
        continue;
      }
      const open = await checkTcp(parsed.host, parsed.port);
      const tag = open ? 'PASS' : 'FAIL';
      console.log(`  ${tag}  ${parsed.host}:${parsed.port}  (${url})`);
      results.push({ label: `TCP ${parsed.host}:${parsed.port}`, pass: open });
    }
  }

  // Summary
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===`);
  for (const r of results) {
    console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.label}`);
  }
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
})();
