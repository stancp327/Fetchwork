function normalize(username) {
  if (!username) return '';
  return String(username).trim().toLowerCase();
}

function isValid(username) {
  const u = normalize(username);
  return u.length > 0;
}

module.exports = { normalize, isValid };
