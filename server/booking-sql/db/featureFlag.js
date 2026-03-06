function isBookingSqlEnabled() {
  return String(process.env.BOOKING_SQL_ENABLED || 'false').toLowerCase() === 'true';
}

module.exports = { isBookingSqlEnabled };
