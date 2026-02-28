/**
 * Google Calendar integration.
 * One-way push only: FetchWork → Google Calendar.
 * All calls are wrapped in try/catch — calendar sync NEVER fails a booking.
 */
const { google } = require('googleapis');
const { encrypt, decrypt } = require('../utils/encryption');
const User = require('../models/User');
const Booking = require('../models/Booking');
const { DateTime } = require('luxon');

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CAL_CLIENT_ID,
    process.env.GOOGLE_CAL_CLIENT_SECRET,
    process.env.GOOGLE_CAL_REDIRECT_URI
  );
}

/** Generate the Google OAuth consent URL for calendar access */
exports.getAuthUrl = (userId) => {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type:  'offline',
    scope:        SCOPES,
    prompt:       'consent',         // force refresh token on every consent
    state:        userId.toString(), // passed back in callback
  });
};

/** Exchange auth code for tokens; store encrypted in DB */
exports.handleCallback = async (code, userId) => {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);

  const update = {
    googleCalConnected:    true,
    googleCalendarId:      'primary',
    googleCalTokenExpiry:  tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    googleCalAccessToken:  encrypt(tokens.access_token),
  };
  if (tokens.refresh_token) {
    update.googleCalRefreshToken = encrypt(tokens.refresh_token);
  }

  await User.findByIdAndUpdate(userId, update);
};

/** Disconnect: revoke token, clear from DB */
exports.disconnect = async (userId) => {
  const user = await User.findById(userId)
    .select('+googleCalRefreshToken +googleCalAccessToken');
  if (!user) return;

  if (user.googleCalRefreshToken) {
    try {
      const client = createOAuth2Client();
      client.setCredentials({ refresh_token: decrypt(user.googleCalRefreshToken) });
      await client.revokeCredentials();
    } catch { /* ignore revoke errors */ }
  }

  await User.findByIdAndUpdate(userId, {
    googleCalConnected:   false,
    googleCalRefreshToken: null,
    googleCalAccessToken:  null,
    googleCalTokenExpiry:  null,
  });
};

/** Get an authorised Google Calendar client for a user, refreshing token if needed */
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

  // Proactively refresh if expiring within 5 minutes
  const expiresAt = user.googleCalTokenExpiry?.getTime() || 0;
  if (!expiresAt || expiresAt - Date.now() < 5 * 60 * 1000) {
    const { credentials } = await client.refreshAccessToken();
    await User.findByIdAndUpdate(userId, {
      googleCalAccessToken: encrypt(credentials.access_token),
      googleCalTokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      ...(credentials.refresh_token
        ? { googleCalRefreshToken: encrypt(credentials.refresh_token) }
        : {}),
    });
    client.setCredentials(credentials);
  }

  return client;
}

/** Build a Google Calendar event resource from a Booking */
function buildEventResource(booking, clientUser, freelancerUser) {
  const tz    = booking.freelancerTimezone;
  const start = DateTime.fromJSDate(booking.startTime).setZone(tz);
  const end   = DateTime.fromJSDate(booking.endTime).setZone(tz);

  const attendees = [
    { email: freelancerUser.email, displayName: `${freelancerUser.firstName} ${freelancerUser.lastName}` },
    { email: clientUser.email,     displayName: `${clientUser.firstName} ${clientUser.lastName}`,     responseStatus: 'accepted' },
  ];

  return {
    summary:     `FetchWork Booking`,
    description: booking.clientNotes ? `Notes: ${booking.clientNotes}` : 'Booked via FetchWork',
    location:    booking.location || (booking.locationType === 'virtual' ? 'Video call' : undefined),
    start:       { dateTime: start.toISO(), timeZone: tz },
    end:         { dateTime: end.toISO(),   timeZone: tz },
    attendees,
    reminders:   { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }] },
    extendedProperties: { private: { fetchworkBookingId: booking._id.toString() } },
  };
}

/**
 * Push a booking to the freelancer's (and optionally client's) Google Calendar.
 * Called async — never throws to the caller.
 */
exports.pushBookingToCalendar = async (bookingId) => {
  let syncStatus = 'failed';
  const update   = { calendarSyncStatus: 'failed' };

  try {
    const booking = await Booking.findById(bookingId)
      .select('+googleCalEventIdFreelancer +googleCalEventIdClient')
      .populate('participants.client', 'email firstName lastName')
      .lean();
    if (!booking) return;

    const freelancer = await User.findById(booking.freelancer)
      .select('email firstName lastName googleCalConnected');
    if (!freelancer?.googleCalConnected) {
      await Booking.findByIdAndUpdate(bookingId, { calendarSyncStatus: 'unlinked' });
      return;
    }

    const client = await getClientForUser(booking.freelancer);
    if (!client) {
      await Booking.findByIdAndUpdate(bookingId, { calendarSyncStatus: 'failed' });
      return;
    }

    const calendar   = google.calendar({ version: 'v3', auth: client });
    const firstClient = booking.participants?.[0]?.client;
    const clientUser  = firstClient || { email: '', firstName: 'Client', lastName: '' };

    const eventResource = buildEventResource(booking, clientUser, freelancer);

    const { data: event } = await calendar.events.insert({
      calendarId:  freelancer.googleCalendarId || 'primary',
      resource:    eventResource,
      sendUpdates: 'all', // sends invite to attendees
    });

    update.googleCalEventIdFreelancer = event.id;
    update.calendarSyncStatus         = 'synced';
    syncStatus = 'synced';

  } catch (err) {
    console.error(`📅 Calendar sync failed for booking ${bookingId}:`, err.message);
  }

  await Booking.findByIdAndUpdate(bookingId, update);
  return syncStatus;
};

/**
 * Update an existing calendar event (reschedule).
 * Falls back to delete + create if no event ID stored.
 */
exports.updateCalendarEvent = async (bookingId) => {
  try {
    const booking = await Booking.findById(bookingId)
      .select('+googleCalEventIdFreelancer')
      .lean();
    if (!booking?.googleCalEventIdFreelancer) {
      return exports.pushBookingToCalendar(bookingId);
    }

    const freelancer = await User.findById(booking.freelancer)
      .select('email firstName lastName googleCalConnected googleCalendarId');
    if (!freelancer?.googleCalConnected) return;

    const client   = await getClientForUser(booking.freelancer);
    if (!client) return;
    const calendar = google.calendar({ version: 'v3', auth: client });

    const firstParticipant = (await Booking.findById(bookingId)
      .populate('participants.client', 'email firstName lastName').lean())
      ?.participants?.[0]?.client;

    const resource = buildEventResource(booking, firstParticipant || {}, freelancer);

    await calendar.events.update({
      calendarId:  freelancer.googleCalendarId || 'primary',
      eventId:     booking.googleCalEventIdFreelancer,
      resource,
      sendUpdates: 'all',
    });

    await Booking.findByIdAndUpdate(bookingId, { calendarSyncStatus: 'synced' });
  } catch (err) {
    console.error(`📅 Calendar update failed for booking ${bookingId}:`, err.message);
    await Booking.findByIdAndUpdate(bookingId, { calendarSyncStatus: 'failed' });
  }
};

/**
 * Delete a calendar event on cancellation.
 */
exports.deleteCalendarEvent = async (bookingId) => {
  try {
    const booking = await Booking.findById(bookingId)
      .select('+googleCalEventIdFreelancer').lean();
    if (!booking?.googleCalEventIdFreelancer) return;

    const freelancer = await User.findById(booking.freelancer)
      .select('googleCalConnected googleCalendarId');
    if (!freelancer?.googleCalConnected) return;

    const client   = await getClientForUser(booking.freelancer);
    if (!client) return;
    const calendar = google.calendar({ version: 'v3', auth: client });

    await calendar.events.delete({
      calendarId:  freelancer.googleCalendarId || 'primary',
      eventId:     booking.googleCalEventIdFreelancer,
      sendUpdates: 'all',
    });

    await Booking.findByIdAndUpdate(bookingId, {
      googleCalEventIdFreelancer: null,
      calendarSyncStatus: 'unlinked',
    });
  } catch (err) {
    if (err.code !== 404 && err.code !== 410) { // 404/410 = already deleted, ignore
      console.error(`📅 Calendar delete failed for booking ${bookingId}:`, err.message);
    }
  }
};
