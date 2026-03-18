import React, { useState, useEffect, useRef } from 'react';
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
  { key: 'tasks',         label: 'Tasks' },
];

export default function TeamNav({ activeTab, setActiveTab }) {
  const [showMore, setShowMore] = useState(false);
  const wrapperRef = useRef(null);

  // Show first 7 tabs inline, rest in overflow menu
  const primaryTabs = TABS.slice(0, 7);
  const overflowTabs = TABS.slice(7);
  const isOverflowActive = overflowTabs.some(t => t.key === activeTab);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showMore) return;
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowMore(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMore]);

  return (
    // tn-bar is a flex row; tn-tabs-scroll handles horizontal overflow for
    // primary tabs. The More wrapper sits OUTSIDE the scroll container so
    // overflow-x: auto can't clip the dropdown.
    <nav className="tn-bar" role="tablist">
      <div className="tn-tabs-scroll">
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
      </div>

      {overflowTabs.length > 0 && (
        <div className="tn-more-wrapper" ref={wrapperRef}>
          <button
            className={`tn-tab tn-tab--more${isOverflowActive ? ' tn-tab--active' : ''}`}
            onClick={() => setShowMore(s => !s)}
            aria-expanded={showMore}
            aria-haspopup="true"
          >
            More ▾
          </button>
          {showMore && (
            <div className="tn-dropdown" role="menu">
              {overflowTabs.map(tab => (
                <button
                  key={tab.key}
                  role="menuitem"
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
