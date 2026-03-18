/**
 * Shared utilities for the Messages component and its hooks.
 * Import from here — do NOT duplicate in hook files.
 */

/**
 * Normalize any user/participant value to a plain string ID.
 * Handles populated objects ({ _id, id, userId }), raw strings, and ObjectId instances.
 */
export const getEntityId = (v) =>
  v && typeof v === 'object'
    ? (v._id || v.id || v.userId || v.toString?.())
    : v;

/**
 * Compare two entity-like values for ID equality.
 */
export const idEq = (a, b) =>
  String(getEntityId(a)) === String(getEntityId(b));
