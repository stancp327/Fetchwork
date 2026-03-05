function canonicalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getGoogleProfileEmail(profile) {
  const direct = profile?.email;
  const fromArray = profile?.emails?.[0]?.value;
  const picked = direct || fromArray || '';
  const canonical = canonicalizeEmail(picked);
  return canonical || null;
}

module.exports = {
  canonicalizeEmail,
  getGoogleProfileEmail,
};
