/**
 * Escape special regex characters to prevent ReDoS attacks.
 * Use when passing user input to new RegExp() or $regex queries.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
