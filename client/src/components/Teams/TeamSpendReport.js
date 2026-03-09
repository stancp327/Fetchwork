import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './TeamSpendReport.css';

function formatCurrency(amount) {
  if (amount == null) return '$0.00';
  return `$${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function monthLabel(offset) {
  const d = new Date();
  d.setMonth(d.getMonth() - offset);
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function getMonthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function currentMonthKey() { return getMonthKey(new Date()); }
function lastMonthKey() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return getMonthKey(d);
}

export default function TeamSpendReport({ teamId, team }) {
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchBilling = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const data = await apiRequest(`/api/teams/${teamId}/billing`);
      setBilling(data);
    } catch {
      setBilling(null);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { fetchBilling(); }, [fetchBilling]);

  if (loading) {
    return <div className="tsr-root"><div className="tsr-loading">Loading spend report...</div></div>;
  }

  if (!billing) {
    return <div className="tsr-root"><div className="tsr-empty">Unable to load billing data.</div></div>;
  }

  const credits = billing.credits || [];
  const thisMonthKey = currentMonthKey();
  const prevMonthKey = lastMonthKey();

  // Compute spend per month from credits (negative amounts = spend, positive = funding)
  const spendByMonth = {};
  const spendByMember = {};
  const spendByCategory = {};

  credits.forEach(c => {
    const mk = getMonthKey(c.createdAt);
    const amount = Math.abs(Number(c.amount || 0));
    const isSpend = (c.type === 'debit' || c.type === 'spend' || Number(c.amount) < 0);

    if (isSpend) {
      spendByMonth[mk] = (spendByMonth[mk] || 0) + amount;

      // Track by member if available
      const memberId = c.userId || c.user || c.createdBy || 'unattributed';
      const memberName = c.userName || c.userEmail || String(memberId).slice(-6);
      if (!spendByMember[memberId]) spendByMember[memberId] = { name: memberName, amount: 0 };
      spendByMember[memberId].amount += amount;

      // Track by category
      const cat = c.category || c.reason || 'Other';
      spendByCategory[cat] = (spendByCategory[cat] || 0) + amount;
    }
  });

  const thisMonthSpend = spendByMonth[thisMonthKey] || 0;
  const lastMonthSpend = spendByMonth[prevMonthKey] || 0;
  const monthlyCap = team?.spendControls?.monthlyCap || 0;
  const capPercent = monthlyCap > 0 ? Math.min((thisMonthSpend / monthlyCap) * 100, 100) : 0;

  // Last 3 months trend
  const trendMonths = [0, 1, 2].map(offset => {
    const d = new Date();
    d.setMonth(d.getMonth() - offset);
    const mk = getMonthKey(d);
    return { label: monthLabel(offset), amount: spendByMonth[mk] || 0 };
  }).reverse();
  const maxTrend = Math.max(...trendMonths.map(m => m.amount), 1);

  // Spend by member sorted
  const totalSpend = Object.values(spendByMember).reduce((s, m) => s + m.amount, 0) || 1;
  const memberRows = Object.entries(spendByMember)
    .map(([id, m]) => ({ id, name: m.name, amount: m.amount, pct: (m.amount / totalSpend) * 100 }))
    .sort((a, b) => b.amount - a.amount);

  // Spend by category sorted
  const totalCatSpend = Object.values(spendByCategory).reduce((s, v) => s + v, 0) || 1;
  const categoryRows = Object.entries(spendByCategory)
    .map(([cat, amount]) => ({ cat, amount, pct: (amount / totalCatSpend) * 100 }))
    .sort((a, b) => b.amount - a.amount);

  const exportCSV = () => {
    const rows = [['Month', 'Amount']];
    Object.entries(spendByMonth).sort().forEach(([m, a]) => rows.push([m, a.toFixed(2)]));
    rows.push([]);
    rows.push(['Member', 'Amount', '% of Total']);
    memberRows.forEach(r => rows.push([r.name, r.amount.toFixed(2), r.pct.toFixed(1) + '%']));
    rows.push([]);
    rows.push(['Category', 'Amount', '% of Total']);
    categoryRows.forEach(r => rows.push([r.cat, r.amount.toFixed(2), r.pct.toFixed(1) + '%']));

    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spend-report-${thisMonthKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="tsr-root">
      <div className="tsr-header">
        <h3 className="tsr-title">Spend Report</h3>
        <button className="tsr-export" onClick={exportCSV}>Export CSV</button>
      </div>

      {/* Summary cards */}
      <div className="tsr-summary">
        <div className="tsr-card">
          <span className="tsr-card-label">This Month</span>
          <span className="tsr-card-value">{formatCurrency(thisMonthSpend)}</span>
        </div>
        <div className="tsr-card">
          <span className="tsr-card-label">Last Month</span>
          <span className="tsr-card-value">{formatCurrency(lastMonthSpend)}</span>
        </div>
        {monthlyCap > 0 && (
          <div className="tsr-card tsr-card--wide">
            <span className="tsr-card-label">vs Cap ({formatCurrency(monthlyCap)})</span>
            <div className="tsr-progress">
              <div
                className={`tsr-progress-bar ${capPercent > 80 ? 'tsr-progress-bar--warn' : ''}`}
                style={{ width: `${capPercent}%` }}
              />
            </div>
            <span className="tsr-card-sub">{capPercent.toFixed(0)}% used</span>
          </div>
        )}
      </div>

      {/* Spend by member */}
      {memberRows.length > 0 && (
        <div className="tsr-section">
          <h4 className="tsr-section-title">Spend by Member</h4>
          <div className="tsr-table">
            <div className="tsr-table-header">
              <span>Member</span>
              <span>Amount</span>
              <span>% of Total</span>
            </div>
            {memberRows.map(row => (
              <div className="tsr-table-row" key={row.id}>
                <span className="tsr-member-name">{row.name}</span>
                <span>{formatCurrency(row.amount)}</span>
                <span>{row.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spend by category */}
      {categoryRows.length > 0 && (
        <div className="tsr-section">
          <h4 className="tsr-section-title">Spend by Category</h4>
          <div className="tsr-bars">
            {categoryRows.map(row => (
              <div className="tsr-bar-row" key={row.cat}>
                <span className="tsr-bar-label">{row.cat}</span>
                <div className="tsr-bar-track">
                  <div className="tsr-bar-fill" style={{ width: `${row.pct}%` }} />
                </div>
                <span className="tsr-bar-value">{formatCurrency(row.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly trend */}
      {trendMonths.some(m => m.amount > 0) && (
        <div className="tsr-section">
          <h4 className="tsr-section-title">Monthly Trend</h4>
          <div className="tsr-trend">
            {trendMonths.map(m => (
              <div className="tsr-trend-col" key={m.label}>
                <div className="tsr-trend-bar-wrap">
                  <div
                    className="tsr-trend-bar"
                    style={{ height: `${(m.amount / maxTrend) * 100}%` }}
                  />
                </div>
                <span className="tsr-trend-amount">{formatCurrency(m.amount)}</span>
                <span className="tsr-trend-label">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
