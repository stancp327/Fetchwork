const { geocode, geoWithinQuery } = require('../config/geocoding');
const { escapeRegex } = require('../utils/sanitize');
const Team = require('../models/Team');

function parsePagination(query) {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

async function buildServiceFilters(query) {
  const filters = {
    isActive: true,
    isArchived: { $ne: true },
    status: 'active',
  };

  if (query.category && query.category !== 'all') {
    filters.category = query.category;
  }

  if (query.skills) {
    const skills = query.skills.split(',').map((skill) => skill.trim());
    filters.skills = { $in: skills };
  }

  if (query.minPrice || query.maxPrice) {
    filters['pricing.basic.price'] = {};
    if (query.minPrice) filters['pricing.basic.price'].$gte = parseFloat(query.minPrice);
    if (query.maxPrice) filters['pricing.basic.price'].$lte = parseFloat(query.maxPrice);
  }

  if (query.locationType && query.locationType !== 'all') {
    filters['location.locationType'] = query.locationType;
  }

  if (query.near && query.near.trim() !== '') {
    const radius = parseInt(query.radius, 10) || 25;
    const coords = await geocode(query.near.trim());
    if (coords) {
      // Use $geoWithin (not $nearSphere) so we can still apply other sorts
      filters['location.coordinates'] = geoWithinQuery(coords, radius);
      // Auto-restrict to local/hybrid unless caller explicitly requested remote
      if (!filters['location.locationType']) {
        filters['location.locationType'] = { $in: ['local', 'hybrid'] };
      }
    }
  }

  // Team member filter: return services owned by members of a specific team
  if (query.teamId) {
    const team = await Team.findById(query.teamId).select('members').lean();
    if (team) {
      const memberIds = (team.members || [])
        .filter(m => m.status === 'active')
        .map(m => m.user);
      filters.freelancer = { $in: memberIds };
      // When fetching for team management, include non-active statuses
      delete filters.status;
      delete filters.isActive;
    }
  }

  if (query.search) {
    const safeSearch = escapeRegex(query.search);
    filters.$or = [
      { title: { $regex: safeSearch, $options: 'i' } },
      { description: { $regex: safeSearch, $options: 'i' } },
      { skills: { $in: [new RegExp(safeSearch, 'i')] } },
    ];
  }

  return filters;
}

module.exports = {
  parsePagination,
  buildServiceFilters,
};
