/**
 * calendarSyncService.js — Google Calendar sync for SQL (Prisma) bookings.
 * One-way push: FetchWork → Google Calendar.
 * Never throws to callers — calendar sync NEVER fails a booking operation.
 *
 * Uses Google Calendar extendedProperties to tag events with the booking/occurrence ID
 * so we can find and update/delete them without storing event IDs in the DB.
 */

const { google } = require('googleapis');
const { encrypt, decrypt } = require('../utils/encryption');
const User = require('../models/User');
const { DateTime } = require('luxon');

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];
const PROP_BOOKING_ID = 'fetchworkBookingId';
const PROP_OCCURRENCE_ID = 'fetchworkOccurrenceId';

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CAL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CAL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CAL_REDIRECT_URI || 'https://fetchwork-1.onrender.com/api/calendar/google/callback'
  );
}

async function getClientForUser(userId) {
  const user = await User.findById(userId)
    .select('+googleCalRefreshToken +googleCalAccessToken googleCalTokenExpiry googleCalConnected');

  if (!user?.googleCalConnected || !user.googleCalRefreshToken) return null;

  const client = createOAuth2Client();
  client.setCredentials({
    refresh_token: decrypt(user.googleCalRefreshToken),
    access_token:  user.googleCalAccessToken ? decrypt(user.googleCalAccessToken) : undefined,
    expiry_date:   user.googleCalTokenExpiry?.getTime(),
  });

  const expiresAt = user.googleCalTokenExpiry?.getTime() || 0;
  if (!expiresAt || expiresAt - Date.now() < 5 * 60 * 1000) {
    try {
      const { credentials } = await client.refreshAccessToken();
      await User.findByIdAndUpdate(userId, {
        googleCalAccessToken: encrypt(credentials.access_token),
        googleCalTokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
        ...(credentials.refresh_token ? { googleCalRefreshToken: encrypt(credentials.refresh_token) } : {}),
      });
      client.setCredentials(credentials);
    } catch (err) {
      console.error('[calendarSyncService] Token refresh failed:', err.message);
      return null;
    }
  }

  return client;
}

function buildEventFromOccurrence(booking, occurrence, freelancerUser, clientName) {
  const tz    = occurrence.timezone || 'America/Los_Angeles';
  const start = DateTime.fromJSDate(occurrence.startAtUtc).setZone(tz);
  const end   = DateTime.fromJSDate(occurrence.endAtUtc).setZone(tz);

  const summary = `FetchWork Session${booking.bookingRef ? ` (${booking.bookingRef})` : ''}`;

  return {
    summary,
    description: booking.notes
      ? `Notes: ${booking.notes}\n\nBooked via FetchWork`
      : 'Booked via FetchWork',
    start: { dateTime: start.toISO(), timeZone: tz },
    end:   { dateTime: end.toISO(),   timeZone: tz },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }] },
    extendedProperties: {
      private: {
        [PROP_BOOKING_ID]:    booking.id,
        [PROP_OCCURRENCE_ID]: occurrence.id,
        source:               'fetchwork',
      },
    },
  };
}

async function findExistingEvent(calendarApi, calendarId, bookingId, occurrenceId) {
  try {
    const propFilter = occurrenceId
      ? `privateExtendedProperty=${PROP_OCCURRENCE_ID}=${occurrenceId}`
      : `privateExtendedProperty=${PROP_BOOKING_ID}=${bookingId}`;

    const { data } = await calendarApi.events.list({
      calendarId,
      privateExtendedProperty: occurrenceId
        ? `${PROP_OCCURRENCE_ID}=${occurrenceId}`
        : `${PROP_BOOKING_ID}=${bookingId}`,
      maxResults: 1,
      singleEvents: true,
    });
    return data.items?.[0] ?? null;
  } catch {
    return null;
  }
}

function getPrisma() {
  return require('../booking-sql/db/client').getPrisma();
}

/**
 * Push a confirmed SQL booking (or specific occurrence) to the freelancer's Google Calendar.
 * Safe to call after confirm — never throws.
 */
exports.syncBookingToCalendar = async (freelancerId, bookingId, occurrenceId = null) => {
  try {
    const prisma   = getPrisma();
    const booking  = await prisma.booking.findUnique({ where: { id: bookingId }, include: { occurrences: true } });
    if (!booking) return;

    const occ = occurrenceId
      ? booking.occurrences.find(o => o.id === occurrenceId)
      : booking.occurrences[0];
    if (!occ) return;

    const freelancer = await User.findById(freelancerId).select('googleCalConnected googleCalendarId firstName lastName');
    if (!freelancer?.googleCalConnected) return;

    const authClient = await getClientForUser(freelancerId);
    if (!authClient) return;

    const calendarApi = google.calendar({ version: 'v3', auth: authClient });
    const calendarId  = freelancer.googleCalendarId || 'primary';

    const existing = await findExistingEvent(calendarApi, calendarId, bookingId, occ.id);
    const resource  = buildEventFromOccurrence(booking, occ, freelancer, 'Client');

    if (existing) {
      await calendarApi.events.update({ calendarId, eventId: existing.id, resource });
    } else {
      await calendarApi.events.insert({ calendarId, resource });
    }
  } catch (err) {
    console.error(`[calendarSyncService] sync failed for booking ${bookingId}:`, err.message);
  }
};

/**
 * Remove a cancelled booking/occurrence from Google Calendar.
 * Safe to call after cancel — never throws.
 */
exports.removeBookingFromCalendar = async (freelancerId, bookingId, occurrenceId = null) => {
  try {
    const freelancer = await User.findById(freelancerId).select('googleCalConnected googleCalendarId');
    if (!freelancer?.googleCalConnected) return;

    const authClient = await getClientForUser(freelancerId);
    if (!authClient) return;

    const calendarApi = google.calendar({ version: 'v3', auth: authClient });
    const calendarId  = freelancer.googleCalendarId || 'primary';

    const existing = await findExistingEvent(calendarApi, calendarId, bookingId, occurrenceId);
    if (!existing) return;

    await calendarApi.events.delete({ calendarId, eventId: existing.id, sendUpdates: 'none' });
  } catch (err) {
    if (err.code !== 404 && err.code !== 410) {
      console.error(`[calendarSyncService] delete failed for booking ${bookingId}:`, err.message);
    }
  }
};

/**
 * Sync all upcoming confirmed bookings for a freelancer.
 * Called from the /sync-all endpoint.
 */
exports.syncAllUpcomingBookings = async (freelancerId) => {
  const prisma = getPrisma();
  const now    = new Date();

  const occurrences = await prisma.bookingOccurrence.findMany({
    where: {
      freelancerId,
      status:    'confirmed',
      startAtUtc: { gt: now },
    },
    include: { booking: true },
    orderBy: { startAtUtc: 'asc' },
    take: 200,
  });

  let synced = 0;
  for (const occ of occurrences) {
    await exports.syncBookingToCalendar(freelancerId, occ.bookingId, occ.id);
    synced++;
  }
  return synced;
};
