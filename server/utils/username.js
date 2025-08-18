const RESERVED = new Set([
  'admin','support','fetchwork','api','login','register','freelancer','profile','jobs','services','messages','payments','settings','vercel','render'
]);

function normalize(username) {
  if (!username) return '';
  return String(username).trim().toLowerCase();
}

function isValid(username) {
  if (!username) return false;
  const u = normalize(username);
  if (RESERVED.has(u)) return false;
  return /^[a-z0-9-]{3,30}$/.test(u);
}

module.exports = { normalize, isValid, RESERVED };
