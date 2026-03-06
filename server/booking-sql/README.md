# booking-sql module

SQL-backed booking subsystem (PostgreSQL + Prisma) behind `BOOKING_SQL_ENABLED` feature flag.

## Current status
- Scaffolded modules: db, repos, services, routes, middleware
- Feature-flag route branches wired for slots/hold/confirm
- SQL readiness endpoint: `GET /api/bookings/sql/status`
- Waiting on `DATABASE_URL` + first migration to implement real SQL queries

## Runtime flags
- `BOOKING_SQL_ENABLED=true|false`
- `BOOKING_SQL_LOG_LEVEL=info|debug`
- `DATABASE_URL=postgresql://...`

## Safety
- Keep flag disabled in production until pre-release audit gate passes.
