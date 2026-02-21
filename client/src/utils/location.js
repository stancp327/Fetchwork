/**
 * Location display helpers for Fetchwork
 * Handles both old string format and new structured location objects
 */

/**
 * Get a display string from a location object or string
 * @param {string|object} location 
 * @returns {string}
 */
export const getLocationDisplay = (location) => {
  if (!location) return 'Remote';
  
  // Old format: plain string
  if (typeof location === 'string') return location;
  
  // New format: structured object
  if (location.locationType === 'remote') return 'Remote';
  
  // Build display from available fields
  const parts = [];
  if (location.city) parts.push(location.city);
  if (location.state) parts.push(location.state);
  if (parts.length > 0) return parts.join(', ');
  
  if (location.zipCode) return location.zipCode;
  if (location.address) return location.address;
  
  return location.locationType === 'local' ? 'Local' : 'Remote';
};

/**
 * Get location type badge text
 */
export const getLocationTypeBadge = (location) => {
  if (!location || typeof location === 'string') return null;
  switch (location.locationType) {
    case 'local': return '📍 Local';
    case 'hybrid': return '🔄 Hybrid';
    case 'remote': return '🌐 Remote';
    default: return null;
  }
};

/**
 * Check if a location is remote
 */
export const isRemoteLocation = (location) => {
  if (!location) return true;
  if (typeof location === 'string') return location.toLowerCase() === 'remote' || location === '';
  return location.locationType === 'remote';
};
