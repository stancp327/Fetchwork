/**
 * Geo Routes
 * GET /api/geo/locate — detect user's approximate location from IP
 *   Uses ip-api.com (free, no key, HTTP only — called server-side)
 *   Returns: { city, zip, lat, lon, region, country, source }
 *
 * GET /api/geo/zip/:zip — validate zip + return city/state
 *   Uses zippopotam.us (free, no key, HTTPS)
 */

const express = require('express');
const https = require('https');
const http = require('http');
const router = express.Router();

function httpGet(url, isHttps = true) {
  return new Promise((resolve, reject) => {
    const lib = isHttps ? https : http;
    lib.get(url, { headers: { 'User-Agent': 'Fetchwork/1.0' } }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('Invalid JSON from geo API')); }
      });
    }).on('error', reject);
  });
}

// Extract real IP (handle proxies / Render's load balancer)
function getRealIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim());
    // Skip private/loopback IPs
    const pub = ips.find(ip => !ip.startsWith('10.') && !ip.startsWith('192.168.') && !ip.startsWith('172.') && ip !== '127.0.0.1' && ip !== '::1');
    if (pub) return pub;
  }
  return req.socket?.remoteAddress || req.ip || '';
}

// GET /api/geo/locate
router.get('/locate', async (req, res) => {
  const ip = getRealIp(req);
  const isDev = !ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('::ffff:127');

  // In dev/localhost return a neutral default so the UI still works
  if (isDev) {
    return res.json({ city: '', zip: '', lat: null, lon: null, region: '', country: 'US', source: 'dev-fallback' });
  }

  try {
    // ip-api.com free tier — HTTP only (called server-side, that's fine)
    const data = await httpGet(`http://ip-api.com/json/${ip}?fields=status,city,zip,lat,lon,regionName,country,countryCode`, false);
    if (data.status !== 'success') {
      return res.json({ city: '', zip: '', lat: null, lon: null, region: '', country: '', source: 'ip-api-fail' });
    }
    res.json({
      city:    data.city    || '',
      zip:     data.zip     || '',
      lat:     data.lat     || null,
      lon:     data.lon     || null,
      region:  data.regionName || '',
      country: data.countryCode || '',
      source:  'ip-api',
    });
  } catch (err) {
    console.error('[geo:locate]', err.message);
    res.json({ city: '', zip: '', lat: null, lon: null, region: '', country: '', source: 'error' });
  }
});

// GET /api/geo/zip/:zip — validate US zip + return city/state
router.get('/zip/:zip', async (req, res) => {
  const zip = req.params.zip.replace(/\D/g, '').slice(0, 5);
  if (zip.length !== 5) return res.status(400).json({ error: 'Invalid zip code' });

  try {
    const data = await httpGet(`https://api.zippopotam.us/us/${zip}`);
    const place = data.places?.[0];
    if (!place) return res.status(404).json({ error: 'Zip code not found' });
    res.json({
      zip,
      city:  place['place name'] || '',
      state: place['state abbreviation'] || '',
      lat:   parseFloat(place.latitude) || null,
      lon:   parseFloat(place.longitude) || null,
    });
  } catch (err) {
    console.error('[geo:zip]', err.message);
    res.status(404).json({ error: 'Zip code not found' });
  }
});

// GET /api/geo/gravatar-img?email=...&size=80 — proxy that redirects to Gravatar with correct MD5
router.get('/gravatar-img', (req, res) => {
  const email = (req.query.email || '').trim().toLowerCase();
  const size = parseInt(req.query.size, 10) || 80;
  if (!email) return res.status(400).json({ error: 'email required' });

  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(email).digest('hex');
  // 302 redirect to Gravatar — cached by the browser
  // Avoid redirect if already attempted to prevent loops
  if (req.headers.referer && req.headers.referer.includes('gravatar.com')) {
    res.status(404).json({ error: 'Gravatar not found' });
  } else {
    res.redirect(302, `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`);
  }
});

module.exports = router;
