import React from 'react';
import './PlanBadge.css';

/**
 * PlanBadge — shows Plus / Pro badge on profile/service cards.
 * Only renders for paid tiers.
 *
 * Usage:
 *   <PlanBadge tier="plus" />   → "Plus" pill
 *   <PlanBadge tier="pro" />    → "Pro" pill
 *   <PlanBadge tier="free" />   → nothing
 *   <PlanBadge planSlug="freelancer_plus" />  → "Plus" pill
 */
const PlanBadge = ({ tier, planSlug, size = 'sm' }) => {
  // Resolve tier from planSlug if needed
  const resolvedTier = tier || (planSlug?.includes('pro') || planSlug?.includes('business') ? 'pro' : planSlug?.includes('plus') ? 'plus' : 'free');

  if (!resolvedTier || resolvedTier === 'free') return null;

  const label = resolvedTier === 'pro' ? 'Pro' : 'Plus';

  return (
    <span className={`plan-badge plan-badge-${resolvedTier} plan-badge-${size}`}>
      {label}
    </span>
  );
};

export default PlanBadge;
