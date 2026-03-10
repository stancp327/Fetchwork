function normalizeText(input = '') {
  return String(input)
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // un-obfuscate common tricks: "j o h n @ g m a i l" → "john@gmail"
    .replace(/\s*\(\s*at\s*\)\s*/gi, '@')
    .replace(/\b(at)\s+(the\s+)?(sign\s+)?([a-z])/gi, '@$4')
    .replace(/\[at\]/gi, '@')
    .replace(/\s*\(\s*dot\s*\)\s*/gi, '.')
    .replace(/\[dot\]/gi, '.')
    .replace(/\s+dot\s+com\b/gi, '.com')
    .trim();
}

function detectOffPlatform(text = '') {
  const t = normalizeText(text);
  if (!t) return { score: 0, confidence: 'low', action: 'allow', hits: [] };

  const rules = [
    // Contact info — high signal
    { id: 'R_EMAIL',           re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,                                                 points: 65 },
    { id: 'R_PHONE_US',        re: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,                                    points: 70 },
    { id: 'R_PHONE_INTL',      re: /\+\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/,                            points: 65 },
    // Social / messaging apps
    { id: 'R_MESSAGING_APP',   re: /\b(whatsapp|telegram|signal|kik|snapchat|viber|wechat|line app)\b/i,                      points: 35 },
    { id: 'R_CONTACT_INTENT',  re: /\b(text me|call me|dm me|message me|reach me|find me on|connect on|add me on)\b/i,        points: 30 },
    { id: 'R_SKYPE',           re: /\b(skype|skype id|skype:\s*\S+)\b/i,                                                     points: 40 },
    { id: 'R_DISCORD',         re: /\b(discord|discord tag|#\d{4}\b)/i,                                                      points: 30 },
    // External payments — high signal (bypassing Fetchwork fees)
    { id: 'R_EXT_PAYMENT',     re: /\b(venmo|cash\s*app|paypal\.me|zelle|western\s*union|bank\s*transfer|wire\s*transfer|crypto|bitcoin|eth|usdt)\b/i, points: 60 },
    // Obfuscated contact
    { id: 'R_OBFUSCATED',      re: /\b(\d\s+\d\s+\d\s+\d\s+\d|\w\s*at\s*\w|\w\s*dot\s*(com|net|org|io))\b/i,              points: 40 },
    { id: 'R_URL_SHORTENER',   re: /\b(bit\.ly|tinyurl\.com|t\.co|rb\.gy|shorturl)\b/i,                                     points: 25 },
    // Explicit off-platform solicitation
    { id: 'R_MOVE_OFF',        re: /\b(off\s*(the\s*)?platform|outside\s*(of\s*)?fetchwork|avoid\s*fees|save\s*on\s*fees|work\s*directly|without\s*the\s*(site|app|platform))\b/i, points: 80 },
    { id: 'R_GOOGLE_DOCS',     re: /\b(docs\.google\.com|drive\.google\.com|dropbox\.com|wetransfer\.com)\b/i,               points: 15 }, // lower — legit use
  ];

  const hits = [];
  let score = 0;
  for (const r of rules) {
    if (r.re.test(t)) {
      hits.push(r.id);
      score += r.points;
    }
  }

  // Cap score at 100
  score = Math.min(score, 100);

  const confidence = score >= 65 ? 'high' : score >= 35 ? 'medium' : 'low';

  // Policy:
  //   block  → only for explicit off-platform solicitation or external payment bypass
  //   warn   → contact info (phone/email/messaging apps) — message sends, user sees banner
  //   allow  → everything else
  const hardBlockHits = ['R_MOVE_OFF', 'R_EXT_PAYMENT'];
  const isHardBlock = hits.some(h => hardBlockHits.includes(h));
  const action = isHardBlock ? 'block' : confidence === 'high' || confidence === 'medium' ? 'warn' : 'allow';

  return { score, confidence, action, hits };
}

/**
 * Returns a human-readable reason string for the frontend warning banner.
 */
function getWarningMessage(safety) {
  if (!safety || safety.action === 'allow') return null;
  const hits = safety.hits || [];

  if (hits.includes('R_MOVE_OFF'))       return 'This message appears to ask someone to work outside Fetchwork. That violates our Terms of Service.';
  if (hits.includes('R_EXT_PAYMENT'))    return 'Payments must go through Fetchwork to protect both parties. External payment requests are not allowed.';
  if (hits.includes('R_EMAIL') || hits.includes('R_PHONE_US') || hits.includes('R_PHONE_INTL'))
    return '📞 Heads up: this message contains contact info. For your protection, we recommend keeping communication on Fetchwork until a contract is agreed.';
  if (hits.includes('R_MESSAGING_APP') || hits.includes('R_CONTACT_INTENT'))
    return '💬 Heads up: this message references an external app. Keeping communication on Fetchwork protects both parties and ensures payment security.';
  return 'This message may violate Fetchwork\'s off-platform policy. Please keep communication and payments within the platform.';
}

module.exports = { detectOffPlatform, getWarningMessage };
