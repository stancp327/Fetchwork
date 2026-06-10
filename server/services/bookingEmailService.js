/**
 * bookingEmailService.js
 *
 * Sends booking lifecycle emails with .ics calendar attachments.
 * Uses the existing Resend client from emailService (no new deps).
 */

const emailService = require('./emailService');

// ── .ics helpers ──────────────────────────────────────────────────────────────

function fmtIcsDate(dt) {
  const d = new Date(dt);
  return (
    d.getUTCFullYear().toString() +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0') + 'T' +
    String(d.getUTCHours()).padStart(2, '0') +
    String(d.getUTCMinutes()).padStart(2, '0') +
    String(d.getUTCSeconds()).padStart(2, '0') + 'Z'
  );
}

function escapeIcs(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function generateIcsEvent({ bookingId, serviceTitle, startAtUtc, endAtUtc, freelancerName, freelancerEmail, clientName, clientEmail, description }) {
  const now   = fmtIcsDate(new Date());
  const start = fmtIcsDate(startAtUtc);
  const end   = fmtIcsDate(endAtUtc);
  const uid   = `booking-${bookingId}@fetchwork.net`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FetchWork//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:Booking: ${escapeIcs(serviceTitle)}`,
    `DESCRIPTION:${escapeIcs(description || `Session with ${freelancerName} and ${clientName}`)}`,
    `ORGANIZER;CN="${escapeIcs(freelancerName)}":MAILTO:${freelancerEmail || 'noreply@fetchwork.net'}`,
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;CN="${escapeIcs(clientName)}":MAILTO:${clientEmail || 'noreply@fetchwork.net'}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}

// ── User lookup ───────────────────────────────────────────────────────────────

let User;
function getUser() {
  if (!User) User = require('../models/User');
  return User;
}

async function lookupUsers(...ids) {
  const clean = ids.filter(Boolean).map(String);
  if (!clean.length) return {};
  const Model = getUser();
  const users = await Model.find({ _id: { $in: clean } }).select('_id email firstName lastName').lean();
  const map = {};
  users.forEach(u => { map[String(u._id)] = u; });
  return map;
}

// ── Core send helper ──────────────────────────────────────────────────────────

async function sendWithIcs({ to, subject, content, title, color, icsString }) {
  if (!emailService.resend) {
    console.log(`[bookingEmail disabled] Would send "${subject}" to ${to}`);
    return;
  }
  const html = emailService.getEmailTemplate(content, title, color || '#2563eb');
  const attachments = icsString
    ? [{ filename: 'booking.ics', content: Buffer.from(icsString), content_type: 'text/calendar; charset=UTF-8' }]
    : [];

  try {
    await emailService.resend.emails.send({
      from: emailService.fromEmail,
      to:   [to],
      subject,
      html,
      attachments,
    });
  } catch (err) {
    console.error('[bookingEmail] send failed:', err.message);
  }
}

// ── Public functions ──────────────────────────────────────────────────────────

async function sendBookingConfirmation(booking, occurrence) {
  try {
    const serviceTitle = booking.pricingSnapshotJson?.serviceTitle || 'Service';
    const users = await lookupUsers(booking.clientId, booking.freelancerId);
    const client     = users[booking.clientId]     || {};
    const freelancer = users[booking.freelancerId] || {};

    const ics = occurrence
      ? generateIcsEvent({
          bookingId:       booking.id,
          serviceTitle,
          startAtUtc:      occurrence.startAtUtc,
          endAtUtc:        occurrence.endAtUtc,
          freelancerName:  `${freelancer.firstName || ''} ${freelancer.lastName || ''}`.trim() || 'Freelancer',
          freelancerEmail: freelancer.email,
          clientName:      `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Client',
          clientEmail:     client.email,
          description:     booking.notes,
        })
      : null;

    const clientUrl = process.env.CLIENT_URL || 'https://fetchwork.net';

    if (client.email) {
      const content = `
        <p>Hi ${client.firstName || 'there'},</p>
        <p>Your booking for <strong>${serviceTitle}</strong> has been confirmed!</p>
        <div style="background:#f8f9fa;padding:16px;border-radius:8px;margin:16px 0">
          ${occurrence ? `<p><strong>Date:</strong> ${new Date(occurrence.startAtUtc).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p><strong>Time:</strong> ${new Date(occurrence.startAtUtc).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC</p>` : ''}
          <p><strong>Booking ref:</strong> ${booking.bookingRef || booking.id}</p>
        </div>
        <p style="text-align:center;margin:24px 0">
          <a href="${clientUrl}/bookings/${booking.id}" style="background:#059669;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">View Booking</a>
        </p>
        ${ics ? '<p style="color:#6b7280;font-size:13px">A calendar invite is attached — add it to your calendar with the attachment above.</p>' : ''}
      `;
      await sendWithIcs({ to: client.email, subject: `Booking confirmed — ${serviceTitle}`, content, title: 'Booking Confirmed!', color: '#059669', icsString: ics });
    }

    if (freelancer.email) {
      const content = `
        <p>Hi ${freelancer.firstName || 'there'},</p>
        <p>A new booking for <strong>${serviceTitle}</strong> has been confirmed.</p>
        <div style="background:#f8f9fa;padding:16px;border-radius:8px;margin:16px 0">
          ${occurrence ? `<p><strong>Date:</strong> ${new Date(occurrence.startAtUtc).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>` : ''}
          <p><strong>Client:</strong> ${client.firstName || ''} ${client.lastName || ''}</p>
          <p><strong>Booking ref:</strong> ${booking.bookingRef || booking.id}</p>
        </div>
        <p style="text-align:center;margin:24px 0">
          <a href="${clientUrl}/bookings/${booking.id}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">View Booking</a>
        </p>
      `;
      await sendWithIcs({ to: freelancer.email, subject: `Booking confirmed — ${serviceTitle}`, content, title: 'New Booking Confirmed', color: '#2563eb', icsString: ics });
    }
  } catch (err) {
    console.error('[bookingEmail] sendBookingConfirmation error:', err.message);
  }
}

async function sendBookingReminder(booking, occurrence, type) {
  try {
    const serviceTitle = booking.pricingSnapshotJson?.serviceTitle || 'Service';
    const users = await lookupUsers(booking.clientId, booking.freelancerId);
    const client     = users[booking.clientId]     || {};
    const freelancer = users[booking.freelancerId] || {};
    const timeLabel  = type === '24h' ? 'tomorrow' : 'in about 1 hour';
    const subject    = `Reminder: Your booking is ${timeLabel} — ${serviceTitle}`;

    const ics = occurrence
      ? generateIcsEvent({
          bookingId:       booking.id,
          serviceTitle,
          startAtUtc:      occurrence.startAtUtc,
          endAtUtc:        occurrence.endAtUtc,
          freelancerName:  `${freelancer.firstName || ''} ${freelancer.lastName || ''}`.trim() || 'Freelancer',
          freelancerEmail: freelancer.email,
          clientName:      `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Client',
          clientEmail:     client.email,
        })
      : null;

    const clientUrl = process.env.CLIENT_URL || 'https://fetchwork.net';

    for (const [u, role] of [[client, 'client'], [freelancer, 'freelancer']]) {
      if (!u.email) continue;
      const content = `
        <p>Hi ${u.firstName || 'there'},</p>
        <p>This is a reminder that your ${role === 'client' ? '' : "client's "}booking for <strong>${serviceTitle}</strong> is <strong>${timeLabel}</strong>.</p>
        ${occurrence ? `<div style="background:#f8f9fa;padding:16px;border-radius:8px;margin:16px 0">
          <p><strong>Date:</strong> ${new Date(occurrence.startAtUtc).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p><strong>Time:</strong> ${new Date(occurrence.startAtUtc).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC</p>
        </div>` : ''}
        <p style="text-align:center;margin:24px 0">
          <a href="${clientUrl}/bookings/${booking.id}" style="background:#d97706;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">View Booking</a>
        </p>
      `;
      await sendWithIcs({ to: u.email, subject, content, title: `Booking Reminder — ${timeLabel}`, color: '#d97706', icsString: ics });
    }
  } catch (err) {
    console.error('[bookingEmail] sendBookingReminder error:', err.message);
  }
}

async function sendBookingCancellation(booking, occurrence, cancelledBy) {
  try {
    const serviceTitle = booking.pricingSnapshotJson?.serviceTitle || 'Service';
    const users = await lookupUsers(booking.clientId, booking.freelancerId);
    const client     = users[booking.clientId]     || {};
    const freelancer = users[booking.freelancerId] || {};
    const cancellerLabel = cancelledBy === 'client' ? 'The client' : 'The freelancer';
    const clientUrl = process.env.CLIENT_URL || 'https://fetchwork.net';

    for (const [u, role] of [[client, 'client'], [freelancer, 'freelancer']]) {
      if (!u.email) continue;
      const isCanceller = role === cancelledBy;
      const body = isCanceller
        ? `You cancelled your booking for <strong>${serviceTitle}</strong>.`
        : `${cancellerLabel} has cancelled the booking for <strong>${serviceTitle}</strong>.`;

      const content = `
        <p>Hi ${u.firstName || 'there'},</p>
        <p>${body}</p>
        <p style="text-align:center;margin:24px 0">
          <a href="${clientUrl}/bookings/${booking.id}" style="background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">View Details</a>
        </p>
      `;
      await sendWithIcs({ to: u.email, subject: `Booking cancelled — ${serviceTitle}`, content, title: 'Booking Cancelled', color: '#dc2626', icsString: null });
    }
  } catch (err) {
    console.error('[bookingEmail] sendBookingCancellation error:', err.message);
  }
}

async function sendBookingReschedule(booking, occurrence, oldTime, newTime) {
  try {
    const serviceTitle = booking.pricingSnapshotJson?.serviceTitle || 'Service';
    const users = await lookupUsers(booking.clientId, booking.freelancerId);
    const client     = users[booking.clientId]     || {};
    const freelancer = users[booking.freelancerId] || {};
    const clientUrl = process.env.CLIENT_URL || 'https://fetchwork.net';

    const ics = occurrence
      ? generateIcsEvent({
          bookingId:       booking.id,
          serviceTitle,
          startAtUtc:      occurrence.startAtUtc,
          endAtUtc:        occurrence.endAtUtc,
          freelancerName:  `${freelancer.firstName || ''} ${freelancer.lastName || ''}`.trim() || 'Freelancer',
          freelancerEmail: freelancer.email,
          clientName:      `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Client',
          clientEmail:     client.email,
        })
      : null;

    for (const [u] of [[client], [freelancer]]) {
      if (!u.email) continue;
      const content = `
        <p>Hi ${u.firstName || 'there'},</p>
        <p>Your booking for <strong>${serviceTitle}</strong> has been rescheduled.</p>
        <div style="background:#f8f9fa;padding:16px;border-radius:8px;margin:16px 0">
          ${oldTime ? `<p><strong>Old time:</strong> ${oldTime}</p>` : ''}
          ${newTime ? `<p><strong>New time:</strong> ${newTime}</p>` : ''}
          <p><strong>Booking ref:</strong> ${booking.bookingRef || booking.id}</p>
        </div>
        <p style="text-align:center;margin:24px 0">
          <a href="${clientUrl}/bookings/${booking.id}" style="background:#d97706;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">View Booking</a>
        </p>
        ${ics ? '<p style="color:#6b7280;font-size:13px">Updated calendar invite attached.</p>' : ''}
      `;
      await sendWithIcs({ to: u.email, subject: `Booking rescheduled — ${serviceTitle}`, content, title: 'Booking Rescheduled', color: '#d97706', icsString: ics });
    }
  } catch (err) {
    console.error('[bookingEmail] sendBookingReschedule error:', err.message);
  }
}

module.exports = { sendBookingConfirmation, sendBookingReminder, sendBookingCancellation, sendBookingReschedule, generateIcsEvent };
