import React from 'react';
import './TeamNav.css';

const TABS = [
  { key: 'dashboard',     label: 'Dashboard' },
  { key: 'members',       label: 'Members' },
  { key: 'channels',      label: 'Channels' },
  { key: 'milestones',    label: 'Milestones' },
  { key: 'presentations', label: 'Presentations' },
  { key: 'wallet',        label: 'Wallet' },
  { key: 'settings',      label: 'Settings' },
];

export default function TeamNav({ activeTab, setActiveTab }) {
  return (
    <nav className="tn-bar" role="tablist">
      {TABS.map(tab => (
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
    </nav>
  );
}
