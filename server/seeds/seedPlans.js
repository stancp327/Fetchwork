/**
 * Seed the 6 Fetchwork plans into the DB.
 * Safe to run multiple times — uses upsert by slug.
 *
 * Usage: node server/seeds/seedPlans.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Plan     = require('../models/Plan');

const PLANS = [
  // ── FREELANCER PLANS ────────────────────────────────────────────
  {
    slug:      'freelancer_free',
    name:      'Freelancer Free',
    audience:  'freelancer',
    tier:      'free',
    price:     0,
    interval:  'free',
    feeRates: {
      remoteClient:     0.05,  // not directly used for freelancers but stored for reference
      remoteFreelancer: 0.10,
      localClient:      { upTo50: 4, upTo150: 6, upTo400: 10, above400: 15 },
    },
    features: [
      'local_no_commission',
      'basic_booking',
      'one_time_payments',
      'standard_payout',
      'standard_placement',
      'basic_id_verification',
    ],
    limits: { activeJobs: 3, activeServices: 1, analyticsLevel: 'basic' },
    isDefault:   true,
    description: 'Get started for free. No commission on local jobs.',
    sortOrder:   1,
  },
  {
    slug:      'freelancer_plus',
    name:      'Freelancer Plus',
    audience:  'freelancer',
    tier:      'plus',
    price:     24,
    interval:  'month',
    feeRates: {
      remoteClient:     0.03,
      remoteFreelancer: 0.07,
      localClient:      { upTo50: 3, upTo150: 4, upTo400: 7, above400: 10 },
    },
    features: [
      'local_no_commission',
      'booking_calendar',
      'recurring_billing',
      'prepaid_bundles',
      'session_packages',
      'capacity_controls',
      'intake_forms',
      'repeat_client_tools',
      'one_click_rebooking',
      'faster_payout',
      'basic_analytics',
      'csv_export',
      'priority_support',
      'reduced_local_client_fee',
      'proposal_analytics',
      'profile_analytics',
      'proposal_tools',
      'repeat_client_workflow',
    ],
    limits: { activeJobs: 20, activeServices: 5, analyticsLevel: 'standard' },
    isDefault:   false,
    description: 'Tools to run and grow your service business.',
    sortOrder:   2,
  },
  {
    slug:      'freelancer_pro',
    name:      'Freelancer Pro',
    audience:  'freelancer',
    tier:      'pro',
    price:     59,
    interval:  'month',
    feeRates: {
      remoteClient:     0.02,
      remoteFreelancer: 0.05,
      localClient:      { upTo50: 2, upTo150: 3, upTo400: 5, above400: 8 },
    },
    features: [
      'local_no_commission',
      'booking_calendar',
      'recurring_billing',
      'prepaid_bundles',
      'session_packages',
      'capacity_controls',
      'intake_forms',
      'repeat_client_tools',
      'one_click_rebooking',
      'fastest_payout',
      'advanced_analytics',
      'csv_export',
      'priority_support',
      'deepest_local_fee_discount',
      'featured_placement_eligible',
      'deposits',
      'travel_fees',
      'package_expiration_rules',
      'time_buffers',
      'full_proposal_tools',
      'full_analytics_suite',
      'advanced_workflow_tools',
      'premium_visibility',
    ],
    limits: { activeJobs: null, activeServices: null, analyticsLevel: 'full' },
    isDefault:   false,
    description: 'Full business stack. Lowest fees. Maximum visibility.',
    sortOrder:   3,
  },

  // ── CLIENT PLANS ────────────────────────────────────────────────
  {
    slug:      'client_free',
    name:      'Client Free',
    audience:  'client',
    tier:      'free',
    price:     0,
    interval:  'free',
    feeRates: {
      remoteClient:     0.05,
      remoteFreelancer: 0.10,
      localClient:      { upTo50: 4, upTo150: 6, upTo400: 10, above400: 15 },
    },
    features: [
      'post_jobs',
      'book_services',
      'basic_messaging',
      'basic_spend_summary',
    ],
    limits: { activeJobs: 3, activeServices: null, analyticsLevel: 'basic' },
    isDefault:   true,
    description: 'Post jobs and hire talent for free.',
    sortOrder:   4,
  },
  {
    slug:      'client_plus',
    name:      'Client Plus',
    audience:  'client',
    tier:      'plus',
    price:     19,
    interval:  'month',
    feeRates: {
      remoteClient:     0.03,
      remoteFreelancer: 0.07,
      localClient:      { upTo50: 3, upTo150: 4, upTo400: 7, above400: 10 },
    },
    features: [
      'post_jobs',
      'book_services',
      'basic_messaging',
      'reduced_flat_fee',
      'saved_providers',
      'easy_rebooking',
      'job_templates',
      'repeat_booking_workflow',
      'priority_support',
      'saved_talent_lists',
      'proposal_comparison',
      'improved_hiring_workflow',
      'spend_analytics',
      'csv_export',
    ],
    limits: { activeJobs: 20, activeServices: null, analyticsLevel: 'standard' },
    isDefault:   false,
    description: 'Lower fees and better tools for repeat hiring.',
    sortOrder:   5,
  },
  {
    slug:      'client_business',
    name:      'Client Business',
    audience:  'client',
    tier:      'pro',
    price:     79,
    interval:  'month',
    feeRates: {
      remoteClient:     0.02,
      remoteFreelancer: 0.05,
      localClient:      { upTo50: 2, upTo150: 3, upTo400: 5, above400: 8 },
    },
    features: [
      'post_jobs',
      'book_services',
      'basic_messaging',
      'lowest_flat_fee',
      'saved_providers',
      'easy_rebooking',
      'job_templates',
      'team_accounts',
      'shared_dashboards',
      'spend_reporting',
      'concierge_matching',
      'highest_support_priority',
      'shared_hiring_dashboards',
      'spend_tracking',
      'freelancer_performance_comparisons',
      'team_workflows',
      'full_analytics_suite',
      'csv_export',
    ],
    limits: { activeJobs: null, activeServices: null, analyticsLevel: 'full' },
    isDefault:   false,
    description: 'Team tools and lowest fees for serious hiring.',
    sortOrder:   6,
  },
];

async function seedPlans() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  let created = 0;
  let updated = 0;

  for (const planData of PLANS) {
    const result = await Plan.findOneAndUpdate(
      { slug: planData.slug },
      { $set: planData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const isNew = result.createdAt.getTime() === result.updatedAt.getTime();
    if (isNew) { created++; console.log(`  ✅ Created: ${planData.name}`); }
    else        { updated++; console.log(`  🔄 Updated: ${planData.name}`); }
  }

  console.log(`\nDone — ${created} created, ${updated} updated.`);
  await mongoose.disconnect();
}

seedPlans().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
