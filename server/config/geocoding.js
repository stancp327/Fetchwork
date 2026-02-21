/**
 * Geocoding utility for Fetchwork
 * Converts zip codes and addresses to coordinates for distance-based search
 * 
 * Uses free Nominatim (OpenStreetMap) API for geocoding
 * Rate limit: 1 request/second — fine for search queries
 */

const https = require('https');

// In-memory cache to avoid repeated lookups
const geocodeCache = new Map();

/**
 * Geocode a zip code or address string to [longitude, latitude]
 * Returns null if geocoding fails
 */
async function geocode(query) {
  if (!query || query.trim() === '') return null;
  
  const cacheKey = query.trim().toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  try {
    const encoded = encodeURIComponent(query.trim());
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=us`;
    
    const data = await new Promise((resolve, reject) => {
      https.get(url, { headers: { 'User-Agent': 'Fetchwork/1.0' } }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(e); }
        });
      }).on('error', reject);
    });

    if (data && data.length > 0) {
      const result = [parseFloat(data[0].lon), parseFloat(data[0].lat)]; // [lng, lat] for GeoJSON
      geocodeCache.set(cacheKey, result);
      return result;
    }
    
    return null;
  } catch (err) {
    console.error('Geocoding error:', err.message);
    return null;
  }
}

/**
 * Build a MongoDB $nearSphere query for proximity search
 * @param {number[]} coordinates - [longitude, latitude]
 * @param {number} radiusMiles - search radius in miles
 */
function nearSphereQuery(coordinates, radiusMiles = 25) {
  const radiusMeters = radiusMiles * 1609.34; // miles to meters
  return {
    $nearSphere: {
      $geometry: {
        type: 'Point',
        coordinates: coordinates
      },
      $maxDistance: radiusMeters
    }
  };
}

/**
 * Build a MongoDB $geoWithin query (alternative — doesn't require 2dsphere index to sort)
 * Better for filtering without distance-based sorting
 */
function geoWithinQuery(coordinates, radiusMiles = 25) {
  const radiusRadians = radiusMiles / 3963.2; // miles to radians (Earth radius in miles)
  return {
    $geoWithin: {
      $centerSphere: [coordinates, radiusRadians]
    }
  };
}

module.exports = { geocode, nearSphereQuery, geoWithinQuery };
