function normalizeText(input = '') {
  return String(input)
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

function detectOffPlatform(text = '') {
  const t = normalizeText(text);
  if (!t) return { score: 0, confidence: 'low', action: 'allow', hits: [] };

  const rules = [
    { id: 'R_EMAIL', re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, points: 60 },
    { id: 'R_PHONE_US', re: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/, points: 70 },
    { id: 'R_WHATSAPP_TELEGRAM_SIGNAL', re: /\b(whatsapp|telegram|signal|text me|call me|dm me on)\b/i, points: 25 },
    { id: 'R_URL_SHORTENER', re: /\b(bit\.ly|tinyurl\.com|t\.co)\b/i, points: 20 },
    { id: 'R_EXTERNAL_PAYMENT', re: /\b(venmo|cashapp|cash app|paypal me|zelle)\b/i, points: 45 },
    { id: 'R_HANDLE_OBFUSCATED', re: /\b(at\s+gmail\s+dot\s+com|five\s+five\s+five)\b/i, points: 35 },
  ];

  const hits = [];
  let score = 0;
  for (const r of rules) {
    if (r.re.test(t)) {
      hits.push(r.id);
      score += r.points;
    }
  }

  const confidence = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
  const action = confidence === 'high' ? 'warn' : confidence === 'medium' ? 'nudge' : 'allow';
  return { score, confidence, action, hits };
}

module.exports = { detectOffPlatform };
