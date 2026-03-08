import React from 'react';
import { Link } from 'react-router-dom';
import './TeamUpgradePrompt.css';

const MESSAGES = {
  no_teams: {
    title: 'Teams require a paid plan',
    message: 'Create teams to collaborate with others, share billing, and post jobs together. Upgrade to Pro or Business to unlock team accounts.',
    icon: '🔒',
  },
  team_limit: {
    title: 'Team limit reached',
    message: 'You\'ve reached the maximum number of teams for your current plan. Upgrade to Business to create more teams.',
    icon: '📊',
  },
  member_limit: {
    title: 'Member limit reached',
    message: 'This team has reached its member limit. Upgrade to Business to add more members.',
    icon: '👥',
  },
};

const TeamUpgradePrompt = ({ reason = 'no_teams', currentPlan, limit }) => {
  const config = MESSAGES[reason] || MESSAGES.no_teams;

  return (
    <div className="tup-container">
      <div className="tup-icon">{config.icon}</div>
      <h3 className="tup-title">{config.title}</h3>
      {currentPlan && (
        <span className="tup-plan-badge">Current plan: {currentPlan}</span>
      )}
      <p className="tup-message">
        {config.message}
        {limit != null && ` (Current limit: ${limit})`}
      </p>
      <Link to="/pricing" className="btn btn-primary tup-cta">
        Upgrade to Business
      </Link>
    </div>
  );
};

export default TeamUpgradePrompt;
