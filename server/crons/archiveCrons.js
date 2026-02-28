/**
 * archiveCrons.js — Automated archiving of stale jobs and services.
 *
 * Runs daily at 02:00 server time.
 *
 * Rules:
 *   Jobs:
 *     1. Status 'completed' — archived immediately on completion via the route,
 *        but this cron catches any that slipped through.
 *     2. Deadline more than 14 days ago AND status is not completed/cancelled
 *        — archived as 'past_deadline'.
 *
 *   Services:
 *     1. Not updated in 90+ days AND not already archived — archived as 'inactive'.
 *        (updatedAt covers: edits, new orders, price changes, etc.)
 */

const cron    = require('node-cron');
const Job     = require('../models/Job');
const Service = require('../models/Service');

const PAST_DEADLINE_GRACE_DAYS = 14;
const SERVICE_INACTIVITY_DAYS  = 90;

async function archiveStaleJobs() {
  const now = new Date();

  // ── 1. Completed jobs not yet archived ─────────────────────────────────
  const completedResult = await Job.updateMany(
    {
      status:     'completed',
      isArchived: { $ne: true }
    },
    {
      $set:   { isArchived: true, archivedAt: now, archiveReason: 'completed', isActive: false },
      $unset: { expiresAt: '' }  // Clear TTL — archived jobs must not be auto-deleted
    }
  );

  // ── 2. Jobs past deadline by > 14 days, not completed/cancelled ─────────
  const deadlineCutoff = new Date(now);
  deadlineCutoff.setDate(deadlineCutoff.getDate() - PAST_DEADLINE_GRACE_DAYS);

  const pastDeadlineResult = await Job.updateMany(
    {
      deadline:   { $lt: deadlineCutoff },
      status:     { $nin: ['completed', 'cancelled'] },
      isArchived: { $ne: true }
    },
    {
      $set:   { isArchived: true, archivedAt: now, archiveReason: 'past_deadline', isActive: false },
      $unset: { expiresAt: '' }
    }
  );

  return {
    completed:    completedResult.modifiedCount,
    pastDeadline: pastDeadlineResult.modifiedCount
  };
}

async function archiveStaleServices() {
  const now = new Date();
  const inactivityCutoff = new Date(now);
  inactivityCutoff.setDate(inactivityCutoff.getDate() - SERVICE_INACTIVITY_DAYS);

  const result = await Service.updateMany(
    {
      updatedAt:  { $lt: inactivityCutoff },
      isArchived: { $ne: true }
    },
    {
      $set: {
        isArchived:    true,
        archivedAt:    now,
        archiveReason: 'inactive',
        isActive:      false
      }
    }
  );

  return { inactive: result.modifiedCount };
}

function initArchiveCrons() {
  // Run daily at 02:00
  cron.schedule('0 2 * * *', async () => {
    try {
      const jobStats     = await archiveStaleJobs();
      const serviceStats = await archiveStaleServices();
      console.log(
        `[archive-cron] Jobs: ${jobStats.completed} completed, ${jobStats.pastDeadline} past-deadline | ` +
        `Services: ${serviceStats.inactive} inactive`
      );
    } catch (err) {
      console.error('[archive-cron] Error:', err.message);
    }
  });

  console.log('[archive-cron] Scheduled — daily at 02:00');
}

module.exports = { initArchiveCrons, archiveStaleJobs, archiveStaleServices };
