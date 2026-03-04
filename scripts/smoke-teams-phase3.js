#!/usr/bin/env node

/**
 * Teams Phase 3 smoke checker (3a + 3b endpoints)
 *
 * Usage:
 *   node scripts/smoke-teams-phase3.js
 *   BACKEND_URL=https://fetchwork-1.onrender.com node scripts/smoke-teams-phase3.js
 *
 * Optional authenticated checks:
 *   AUTH_TOKEN=<jwt> TEAM_ID=<teamId> CLIENT_ID=<clientUserId> ORG_ID=<orgId> node scripts/smoke-teams-phase3.js
 */

const BACKEND_URL = process.env.BACKEND_URL || 'https://fetchwork-1.onrender.com';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
const TEAM_ID = process.env.TEAM_ID || '';
const CLIENT_ID = process.env.CLIENT_ID || '';
const ORG_ID = process.env.ORG_ID || '';

const color = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

async function request(path, opts = {}) {
  const url = `${BACKEND_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const res = await fetch(url, { method: opts.method || 'GET', headers, body: opts.body });
  let body = null;
  const text = await res.text();
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { url, status: res.status, body };
}

async function runCheck(name, fn, expected) {
  try {
    const result = await fn();
    const ok = Array.isArray(expected) ? expected.includes(result.status) : result.status === expected;
    const statusLine = `${name}: HTTP ${result.status}`;
    if (ok) {
      console.log(`${color.green('✅')} ${statusLine}`);
      return { ok: true, result };
    }

    console.log(`${color.red('❌')} ${statusLine} (expected ${Array.isArray(expected) ? expected.join('/') : expected})`);
    if (result.body) {
      console.log(`   body: ${JSON.stringify(result.body).slice(0, 240)}`);
    }
    return { ok: false, result };
  } catch (err) {
    console.log(`${color.red('❌')} ${name}: ${err.message}`);
    return { ok: false, result: null };
  }
}

async function main() {
  console.log(`🔎 Teams Phase 3 smoke check`);
  console.log(`Backend: ${BACKEND_URL}`);

  const checks = [];

  // Public/basic sanity
  checks.push(await runCheck('Health endpoint', () => request('/health'), 200));

  // Auth-guard checks for new endpoints
  checks.push(await runCheck('Organizations mine requires auth', () => request('/api/organizations/mine'), 401));
  checks.push(await runCheck('Custom roles route requires auth', () => request('/api/teams/123/custom-roles'), 401));
  checks.push(await runCheck('Linked clients route requires auth', () => request('/api/teams/123/clients'), 401));

  if (AUTH_TOKEN) {
    const authHeaders = { Authorization: `Bearer ${AUTH_TOKEN}` };

    checks.push(await runCheck('Organizations mine (authed)', () => request('/api/organizations/mine', { headers: authHeaders }), [200, 404]));

    if (ORG_ID) {
      checks.push(await runCheck('Organization detail (authed)', () => request(`/api/organizations/${ORG_ID}`, { headers: authHeaders }), [200, 403, 404]));
    } else {
      console.log(color.yellow('ℹ️ ORG_ID not set; skipped org detail authenticated check.'));
    }

    if (TEAM_ID) {
      checks.push(await runCheck('Team custom roles (authed)', () => request(`/api/teams/${TEAM_ID}/custom-roles`, { headers: authHeaders }), [200, 403, 404]));
      checks.push(await runCheck('Team clients (authed)', () => request(`/api/teams/${TEAM_ID}/clients`, { headers: authHeaders }), [200, 403, 404]));
      checks.push(await runCheck('Team controls (authed)', () => request(`/api/teams/${TEAM_ID}/spend-controls`, { headers: authHeaders }), [200, 403, 404]));
      checks.push(await runCheck('Team user lookup (authed)', () => request(`/api/teams/${TEAM_ID}/user-lookup?q=test`, { headers: authHeaders }), [200, 403, 404]));

      if (CLIENT_ID) {
        checks.push(await runCheck('Team client access snapshot (authed)', () => request(`/api/teams/${TEAM_ID}/clients/${CLIENT_ID}/access`, { headers: authHeaders }), [200, 403, 404]));
      } else {
        console.log(color.yellow('ℹ️ CLIENT_ID not set; skipped client access snapshot check.'));
      }
    } else {
      console.log(color.yellow('ℹ️ AUTH_TOKEN set without TEAM_ID; skipped team-specific authenticated checks.'));
    }
  } else {
    console.log(color.yellow('ℹ️ No AUTH_TOKEN set; running unauthenticated smoke only.'));
  }

  const failed = checks.filter((c) => !c.ok).length;
  console.log('');
  if (failed === 0) {
    console.log(color.green('✅ Teams Phase 3 smoke checks passed'));
    process.exit(0);
  }

  console.log(color.red(`❌ Teams Phase 3 smoke checks failed (${failed} failing checks)`));
  process.exit(1);
}

main();
