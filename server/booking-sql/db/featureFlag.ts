export const isBookingSqlEnabled = (): boolean =>
  String(process.env.BOOKING_SQL_ENABLED || 'false').toLowerCase() === 'true';
