/**
 * recurringCron.js — Daily cron that spawns the next instance of recurring jobs.
 *
 * Runs at 06:00 server time.
 * Finds completed jobs with recurring.enabled=true and nextRunDate <= now,
 * creates a fresh 'open' job copy, and sends the previous freelancer a first-look invite.
 */
const cron         = require('node-cron');
const Job          = require('../models/Job');
const Notification = require('../models/Notification');
const User         = require('../models/User');

// ── Interval → next date ──────────────────────────────────────────
function nextDate(from, interval) {
  const d = new Date(from);
  switch (interval) {
    case 'weekly':   d.setDate(d.getDate() + 7);  break;
    case 'biweekly': d.setDate(d.getDate() + 14); break;
    case 'monthly':  d.setMonth(d.getMonth() + 1); break;
    default:         d.setMonth(d.getMonth() + 1);
  }
  return d;
}

async function spawnRecurringJobs() {
  console.log('[recurringCron] Checking recurring jobs...');
  try {
    const now = new Date();

    const due = await Job.find({
      'recurring.enabled':     true,
      'recurring.nextRunDate': { $lte: now },
      status:                  'completed',
    }).lean();

    if (!due.length) {
      console.log('[recurringCron] No recurring jobs due.');
      return;
    }

    for (const parent of due) {
      try {
        // Stop if past endDate
        if (parent.recurring.endDate && now > new Date(parent.recurring.endDate)) {
          await Job.updateOne(
            { _id: parent._id },
            { 'recurring.enabled': false }
          );
          continue;
        }

        const rootId = parent.recurring.parentJobId || parent._id;

        // Create new job instance — same details, fresh state
        const newJob = await Job.create({
          title:           parent.title,
          description:     parent.description,
          category:        parent.category,
          subcategory:     parent.subcategory,
          skills:          parent.skills,
          budget:          parent.budget,
          duration:        parent.duration,
          experienceLevel: parent.experienceLevel,
          location:        parent.location,
          deadline:        null,
          isUrgent:        parent.isUrgent,
          jobType:         parent.jobType,
          client:          parent.client,
          status:          'open',
          recurring: {
            enabled:       true,
            interval:      parent.recurring.interval,
            endDate:       parent.recurring.endDate,
            parentJobId:   rootId,
            instanceCount: (parent.recurring.instanceCount || 0) + 1,
            nextRunDate:   nextDate(now, parent.recurring.interval),
          },
        });

        // Update parent's nextRunDate (for the new instance going forward)
        await Job.updateOne(
          { _id: parent._id },
          { 'recurring.nextRunDate': null } // parent is done spawning; new instance takes over
        );

        // Notify the previous freelancer with first-look invite
        if (parent.freelancer) {
          const client = await User.findById(parent.client).select('firstName lastName').lean();
          const clientName = `${client?.firstName || ''} ${client?.lastName || ''}`.trim() || 'Your client';

          await Notification.create({
            user:    parent.freelancer,
            type:    'job_proposal_received',
            message: `♻️ ${clientName} posted a recurring job you worked on: "${parent.title}". You have first look — apply now!`,
            link:    `/jobs/${newJob._id}`,
          });
        }

        // Notify client
        await Notification.create({
          user:    parent.client,
          type:    'system',
          message: `♻️ Your recurring job "${parent.title}" has been automatically reposted.`,
          link:    `/jobs/${newJob._id}`,
        });

        console.log(`[recurringCron] Spawned new job ${newJob._id} from ${parent._id}`);
      } catch (err) {
        console.error(`[recurringCron] Failed to spawn from ${parent._id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[recurringCron] Fatal error:', err.message);
  }
}

// ── Schedule: 06:00 daily ─────────────────────────────────────────
function init() {
  cron.schedule('0 6 * * *', spawnRecurringJobs, { timezone: 'America/Los_Angeles' });
  console.log('[recurringCron] Scheduled (daily 06:00 PT)');
}

module.exports = { init, spawnRecurringJobs };
