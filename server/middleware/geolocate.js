/**
 * Geolocation Middleware
 * Uses ip-api.com (free, no API key, 1000 req/min)
 * Attaches geo data to req.geo on every request.
 * 
 * Use geolocateLogin() on auth routes to track login locations
 * and alert users on new-country logins.
 */

const https = require('https');

// Simple in-memory cache — avoids duplicate lookups per request burst
const geoCache = new Map(); // ip → { data, cachedAt }
const GEO_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || req.ip || null;
}

function lookupIp(ip) {
  return new Promise((resolve) => {
    // Skip private/loopback IPs
    if (!ip || ip === '::1' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return resolve(null);
    }

    const cached = geoCache.get(ip);
    if (cached && Date.now() - cached.cachedAt < GEO_CACHE_TTL) {
      return resolve(cached.data);
    }

    const req = https.get(
      `https://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,lat,lon,timezone,isp,proxy,hosting`,
      { timeout: 3000 },
      (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            if (data.status === 'success') {
              const geo = {
                ip,
                country: data.country,
                countryCode: data.countryCode,
                region: data.regionName,
                city: data.city,
                lat: data.lat,
                lon: data.lon,
                timezone: data.timezone,
                isp: data.isp,
                isProxy: data.proxy,
                isHosting: data.hosting, // datacenter/VPN flag
              };
              geoCache.set(ip, { data: geo, cachedAt: Date.now() });
              resolve(geo);
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * Middleware: attaches req.geo to every request (non-blocking)
 */
async function geoMiddleware(req, res, next) {
  const ip = getClientIp(req);
  // Fire and forget — don't delay the request
  lookupIp(ip).then(geo => { req.geo = geo; }).catch(() => {});
  next();
}

/**
 * geolocateLogin(user, req) — call after successful login
 * Stores last known location on user, returns geo data
 * Also flags if login is from a new country (for alert emails)
 */
async function geolocateLogin(user, req) {
  const ip = getClientIp(req);
  const geo = await lookupIp(ip);
  if (!geo) return null;

  const previousCountry = user.lastLoginCountry;
  const isNewCountry = previousCountry && previousCountry !== geo.countryCode;
  const isSuspiciousIp = geo.isProxy || geo.isHosting;

  // Update user's login location fields
  user.lastLoginIp = geo.ip;
  user.lastLoginCountry = geo.countryCode;
  user.lastLoginCity = `${geo.city}, ${geo.region}`;
  user.lastLoginAt = new Date();

  return {
    geo,
    isNewCountry,
    previousCountry,
    isSuspiciousIp,
  };
}

module.exports = { geoMiddleware, geolocateLogin, lookupIp, getClientIp };
