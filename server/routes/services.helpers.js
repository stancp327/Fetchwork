const { geocode, nearSphereQuery } = require('../config/geocoding');
const { escapeRegex } = require('../utils/sanitize');

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
      filters['location.coordinates'] = nearSphereQuery(coords, radius);
      if (!filters['location.locationType']) {
        filters['location.locationType'] = { $in: ['local', 'hybrid'] };
      }
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
