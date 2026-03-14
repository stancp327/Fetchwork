import React, { useState } from 'react';
import './TeamNav.css';

const TABS = [
  { key: 'dashboard',     label: 'Dashboard' },
  { key: 'jobs',          label: 'Jobs' },
  { key: 'members',       label: 'Members' },
  { key: 'channels',      label: 'Channels' },
  { key: 'milestones',    label: 'Milestones' },
  { key: 'presentations', label: 'Presentations' },
  { key: 'wallet',        label: 'Wallet' },
  { key: 'activity',      label: 'Activity' },
  { key: 'analytics',     label: 'Analytics' },
  { key: 'approvals',     label: 'Approvals' },
  { key: 'notes',         label: 'Notes' },
  { key: 'pipeline',      label: 'Pipeline' },
  { key: 'contracts',     label: 'Contracts' },
  { key: 'organization',  label: 'Organization' },
  { key: 'settings',      label: 'Settings' },
];

export default function TeamNav({ activeTab, setActiveTab }) {
  const [showMore, setShowMore] = useState(false);

  // Show first 7 tabs inline, rest in overflow menu
  const primaryTabs = TABS.slice(0, 7);
  const overflowTabs = TABS.slice(7);
  const isOverflowActive = overflowTabs.some(t => t.key === activeTab);

  return (
    <nav className="tn-bar" role="tablist">
      {primaryTabs.map(tab => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={activeTab === tab.key}
          className={`tn-tab${activeTab === tab.key ? ' tn-tab--active' : ''}`}
          onClick={() => setActiveTab(tab.key)}
        >
          {tab.label}
        </button>
      ))}
      {overflowTabs.length > 0 && (
        <div className="tn-more-wrapper">
          <button
            className={`tn-tab tn-tab--more${isOverflowActive ? ' tn-tab--active' : ''}`}
            onClick={() => setShowMore(s => !s)}
            aria-expanded={showMore}
          >
            More...
          </button>
          {showMore && (
            <div className="tn-dropdown">
              {overflowTabs.map(tab => (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  className={`tn-dropdown-item${activeTab === tab.key ? ' tn-dropdown-item--active' : ''}`}
                  onClick={() => { setActiveTab(tab.key); setShowMore(false); }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
