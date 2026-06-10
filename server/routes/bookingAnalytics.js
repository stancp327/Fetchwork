const express = require('express');
const router  = express.Router();
const { authenticateToken } = require('../middleware/auth');

let getPrisma;
try {
  getPrisma = require('../booking-sql/db/client').getPrisma;
} catch (_) {}

function requireDb(req, res, next) {
  if (!getPrisma || !process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Booking analytics unavailable' });
  }
  next();
}

// ── GET /api/booking-analytics ──────────────────────────────────────────────
router.get('/', authenticateToken, requireDb, async (req, res) => {
  try {
    const prisma = getPrisma();
    const freelancerId = req.user._id.toString();
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    // ── Booking counts ──────────────────────────────────────────────────────
    const [total, thisMonth, thisWeek] = await Promise.all([
      prisma.booking.count({ where: { freelancerId } }),
      prisma.booking.count({ where: { freelancerId, createdAt: { gte: thisMonthStart } } }),
      prisma.booking.count({ where: { freelancerId, createdAt: { gte: weekStart } } }),
    ]);

    // ── Completion / no-show rates ──────────────────────────────────────────
    const [completed, noShows, cancelled] = await Promise.all([
      prisma.booking.count({ where: { freelancerId, currentState: 'completed' } }),
      prisma.booking.count({ where: { freelancerId, currentState: { in: ['no_show_client', 'no_show_freelancer'] } } }),
      prisma.booking.count({ where: { freelancerId, currentState: { in: ['cancelled_by_client', 'cancelled_by_freelancer'] } } }),
    ]);
    const nonCancelled    = total - cancelled;
    const completionRate  = nonCancelled > 0 ? Math.round((completed / nonCancelled) * 100) : 0;
    const noShowRate      = total > 0 ? Math.round((noShows / total) * 100) : 0;

    // ── Revenue ─────────────────────────────────────────────────────────────
    const [allRevenue, monthRevenue] = await Promise.all([
      prisma.chargeRecord.aggregate({
        _sum: { amountCents: true },
        _avg: { amountCents: true },
        where: { booking: { freelancerId }, state: { in: ['captured', 'succeeded'] } },
      }),
      prisma.chargeRecord.aggregate({
        _sum: { amountCents: true },
        where: {
          booking: { freelancerId },
          state: { in: ['captured', 'succeeded'] },
          createdAt: { gte: thisMonthStart },
        },
      }),
    ]);

    const revenueTotal        = Number(allRevenue._sum.amountCents || 0);
    const revenueThisMonth    = Number(monthRevenue._sum.amountCents || 0);
    const averageSessionValueCents = allRevenue._avg.amountCents != null
      ? Math.round(Number(allRevenue._avg.amountCents))
      : 0;

    // ── Repeat client rate ──────────────────────────────────────────────────
    const clientGroups = await prisma.booking.groupBy({
      by: ['clientId'],
      where: { freelancerId },
      _count: { clientId: true },
    });
    const totalClients  = clientGroups.length;
    const repeatClients = clientGroups.filter(g => g._count.clientId >= 2).length;
    const repeatClientRate = totalClients > 0
      ? Math.round((repeatClients / totalClients) * 100)
      : 0;

    // ── Upcoming ────────────────────────────────────────────────────────────
    const upcomingCount = await prisma.bookingOccurrence.count({
      where: { freelancerId, status: 'confirmed', startAtUtc: { gt: now } },
    });

    // ── Busiest day / hour (raw SQL needed for EXTRACT) ─────────────────────
    let busiestDayOfWeek  = null;
    let busiestHourOfDay  = null;

    try {
      const [dayRows, hourRows] = await Promise.all([
        prisma.$queryRaw`
          SELECT EXTRACT(DOW FROM "startAtUtc")::int AS dow, COUNT(*)::int AS cnt
          FROM "BookingOccurrence"
          WHERE "freelancerId" = ${freelancerId}
          GROUP BY dow
          ORDER BY cnt DESC
          LIMIT 1
        `,
        prisma.$queryRaw`
          SELECT EXTRACT(HOUR FROM "startAtUtc")::int AS hour, COUNT(*)::int AS cnt
          FROM "BookingOccurrence"
          WHERE "freelancerId" = ${freelancerId}
          GROUP BY hour
          ORDER BY cnt DESC
          LIMIT 1
        `,
      ]);

      if (dayRows.length  > 0) busiestDayOfWeek  = dayRows[0].dow;
      if (hourRows.length > 0) busiestHourOfDay  = hourRows[0].hour;
    } catch (_) {}

    res.json({
      bookingsThisWeek:        thisWeek,
      bookingsThisMonth:       thisMonth,
      bookingsTotal:           total,
      completionRate,
      noShowRate,
      averageSessionValueCents,
      busiestDayOfWeek,
      busiestHourOfDay,
      revenueThisMonth,
      revenueTotal,
      repeatClientRate,
      upcomingCount,
    });
  } catch (err) {
    console.error('[booking-analytics] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/booking-analytics/trends?period=weekly&weeks=12 ────────────────
router.get('/trends', authenticateToken, requireDb, async (req, res) => {
  try {
    const prisma = getPrisma();
    const freelancerId = req.user._id.toString();
    const weeks = Math.min(52, Math.max(1, parseInt(req.query.weeks) || 12));
    const since = new Date(Date.now() - weeks * 7 * 24 * 3600 * 1000);

    const rows = await prisma.$queryRaw`
      SELECT
        DATE_TRUNC('week', b."createdAt") AS week,
        COUNT(b.id)::int                  AS bookings,
        COALESCE(
          SUM(CASE WHEN cr.state IN ('captured','succeeded') THEN cr."amountCents" ELSE 0 END),
          0
        )::bigint                         AS revenue,
        COUNT(DISTINCT b."clientId")::int AS "newClients"
      FROM "Booking" b
      LEFT JOIN "ChargeRecord" cr ON cr."bookingId" = b.id
      WHERE b."freelancerId" = ${freelancerId}
        AND b."createdAt"    >= ${since}
      GROUP BY DATE_TRUNC('week', b."createdAt")
      ORDER BY week ASC
    `;

    const trends = rows.map(r => ({
      week:       r.week instanceof Date ? r.week.toISOString().slice(0, 10) : String(r.week),
      bookings:   r.bookings,
      revenue:    Number(r.revenue),
      newClients: r.newClients,
    }));

    res.json({ trends, weeks });
  } catch (err) {
    console.error('[booking-analytics/trends] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
