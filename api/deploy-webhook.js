/**
 * deploy-webhook.js — Vercel serverless function
 * Receives Render deploy webhooks and sends Telegram notifications.
 *
 * Configure in Render: Service → Settings → Notifications → Webhook
 * URL: https://fetchwork.net/api/deploy-webhook
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

async function sendTelegram(text) {
  if (!BOT_TOKEN || !CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' }),
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};

    // Render webhook payload shape
    const action  = body.action  || '';   // deploy_live, deploy_failed, etc.
    const service = body.service?.name || body.service || 'Unknown service';
    const commit  = body.deploy?.commit?.message?.split('\n')[0] || '';
    const url     = body.deploy?.url || body.service?.serviceDetails?.url || '';

    let emoji, status;
    if (action === 'deploy_live' || action === 'service_updated') {
      emoji  = '✅';
      status = 'Deploy succeeded';
    } else if (action === 'deploy_failed' || action === 'service_update_failed') {
      emoji  = '❌';
      status = 'Deploy FAILED';
    } else if (action === 'deploy_started' || action === 'build_started') {
      emoji  = '🔄';
      status = 'Deploy started';
    } else {
      // Unknown action — still notify
      emoji  = 'ℹ️';
      status = `Deploy event: ${action}`;
    }

    const lines = [
      `${emoji} <b>${status}</b>`,
      `📦 <b>${service}</b>`,
    ];
    if (commit) lines.push(`💬 ${commit}`);
    if (url)    lines.push(`🔗 <a href="${url}">${url}</a>`);

    await sendTelegram(lines.join('\n'));
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('deploy-webhook error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
