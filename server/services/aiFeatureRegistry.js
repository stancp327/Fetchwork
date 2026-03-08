/**
 * aiFeatureRegistry.js
 * Central registry of all AI features on Fetchwork.
 * Used for admin toggles and user preference management.
 */

const AI_FEATURES = [
  // ── Proposal & Job features ──────────────────────────────────────────────
  { key: 'proposal_writer',      name: 'AI Proposal Writer',       tier: 'plus',  audience: 'freelancer', location: 'Quick Apply form',           description: 'Drafts a cover letter based on the job + your profile' },
  { key: 'proposal_summarizer',  name: 'AI Proposal Summarizer',   tier: 'plus',  audience: 'client',     location: 'Job proposals page',         description: 'Summarizes all proposals so you can decide faster' },
  { key: 'proposal_ranker',      name: 'AI Proposal Ranker',       tier: 'plus',  audience: 'client',     location: 'Job proposals page',         description: 'Scores each proposal 1-10 with reasoning' },
  { key: 'redflag_detector',     name: 'AI Red Flag Detector',     tier: 'plus',  audience: 'client',     location: 'Job proposals page',         description: 'Flags copy-pasted or suspicious proposals' },
  { key: 'job_description',      name: 'AI Job Description',       tier: 'plus',  audience: 'client',     location: 'Post a Job form',            description: 'Generates job description from a short brief' },
  { key: 'job_title_fixer',      name: 'AI Title Fixer',           tier: 'free',  audience: 'client',     location: 'Post a Job form',            description: 'Improves vague job titles for better applicants' },
  { key: 'scope_expander',       name: 'AI Scope Expander',        tier: 'free',  audience: 'client',     location: 'Post a Job form',            description: 'Expands a short description into a full scope' },
  { key: 'budget_estimator',     name: 'AI Budget Estimator',      tier: 'free',  audience: 'client',     location: 'Post a Job form',            description: 'Estimates a fair budget range for your job' },
  { key: 'skills_suggester',     name: 'AI Skills Suggester',      tier: 'free',  audience: 'client',     location: 'Post a Job form',            description: 'Suggests required skills based on job description' },
  { key: 'category_classifier',  name: 'AI Category Classifier',   tier: 'free',  audience: 'client',     location: 'Post a Job form',            description: 'Auto-detects the right job category' },
  // ── Profile & Services ───────────────────────────────────────────────────
  { key: 'profile_optimizer',    name: 'AI Profile Optimizer',     tier: 'free',  audience: 'freelancer', location: 'Profile page',               description: 'Gives specific tips to improve your profile' },
  { key: 'rate_advisor',         name: 'AI Rate Advisor',          tier: 'plus',  audience: 'freelancer', location: 'Profile page',               description: 'Compares your rate to market rates for your skills' },
  { key: 'portfolio_writer',     name: 'AI Portfolio Writer',      tier: 'plus',  audience: 'freelancer', location: 'Portfolio editor',           description: 'Writes portfolio item descriptions from context' },
  { key: 'service_seo',          name: 'AI Service SEO',           tier: 'plus',  audience: 'freelancer', location: 'Create Service form',        description: 'Suggests keywords and title improvements for your service' },
  // ── Communication ────────────────────────────────────────────────────────
  { key: 'response_drafter',     name: 'AI Response Drafter',      tier: 'plus',  audience: 'both',       location: 'Messages',                   description: 'Drafts a professional reply to the last message' },
  { key: 'message_translator',   name: 'AI Message Translator',    tier: 'free',  audience: 'both',       location: 'Messages (per message)',      description: 'Translates any message to your language' },
  { key: 'dispute_risk',         name: 'AI Dispute Risk Check',    tier: 'pro',   audience: 'both',       location: 'Messages',                   description: 'Detects escalating conversations before they become disputes' },
  // ── Search ───────────────────────────────────────────────────────────────
  { key: 'semantic_search',      name: 'AI Semantic Search',       tier: 'free',  audience: 'both',       location: 'Search results',             description: 'Re-ranks results using natural language understanding' },
  { key: 'ai_matching',          name: 'AI Freelancer Matching',   tier: 'pro',   audience: 'client',     location: 'Job detail page',            description: 'AI-powered freelancer recommendations for your job' },
  // ── Reviews ──────────────────────────────────────────────────────────────
  { key: 'review_summarizer',    name: 'AI Review Summarizer',     tier: 'free',  audience: 'client',     location: 'Freelancer profile',         description: 'Summarizes all reviews into a quick insight' },
  // ── Contracts & Milestones ───────────────────────────────────────────────
  { key: 'contract_summary',     name: 'AI Contract Summary',      tier: 'pro',   audience: 'both',       location: 'Contract detail',            description: 'Explains contract terms in plain English' },
  { key: 'milestone_suggester',  name: 'AI Milestone Suggester',   tier: 'pro',   audience: 'both',       location: 'Create Contract form',       description: 'Suggests realistic milestones and deadlines' },
  // ── Earnings & Forecasting ───────────────────────────────────────────────
  { key: 'earnings_forecast',    name: 'AI Earnings Forecast',     tier: 'pro',   audience: 'freelancer', location: 'Earnings dashboard',         description: 'Predicts next month earnings with actionable tips' },
  // ── Calls ────────────────────────────────────────────────────────────────
  { key: 'meeting_notes',        name: 'AI Meeting Notes',         tier: 'pro',   audience: 'both',       location: 'After video calls',          description: 'Generates meeting notes and action items post-call' },
  // ── Disputes ─────────────────────────────────────────────────────────────
  { key: 'dispute_assistant',    name: 'AI Dispute Assistant',     tier: 'pro',   audience: 'both',       location: 'Dispute filing form',        description: 'Helps write a clear, compelling dispute description' },
  // ── Support ──────────────────────────────────────────────────────────────
  { key: 'support_chat',         name: 'AI Support Chat',          tier: 'free',  audience: 'both',       location: 'Support chat widget',        description: 'AI-powered support assistant available site-wide' },
];

/**
 * Default platform-level state (all enabled).
 * Stored in SystemConfig collection, overridden by admin.
 */
const DEFAULT_PLATFORM_STATE = Object.fromEntries(
  AI_FEATURES.map(f => [f.key, true])
);

module.exports = { AI_FEATURES, DEFAULT_PLATFORM_STATE };
