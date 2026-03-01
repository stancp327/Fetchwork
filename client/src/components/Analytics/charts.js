/**
 * charts.js — Lightweight chart components for the user analytics page.
 * Each component takes domain-specific data and handles its own Chart.js config.
 */
import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Tooltip, Legend, Filler, Title,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Tooltip, Legend, Filler, Title,
);

const CHART_COLORS = {
  primary:  '#2563eb',
  success:  '#16a34a',
  warning:  '#d97706',
  danger:   '#dc2626',
  muted:    '#6b7280',
  purple:   '#7c3aed',
  cyan:     '#0891b2',
  palette:  ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#f59e0b'],
};

const BASE_OPTS = {
  responsive:           true,
  maintainAspectRatio:  false,
  animation:            { duration: 600 },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(15,23,42,0.92)',
      titleColor: '#f8fafc', bodyColor: '#cbd5e1',
      padding: 10, cornerRadius: 8,
    },
  },
};

// ── Month label formatter ─────────────────────────────────────────
const fmtMonth = (ym) => {
  const [y, m] = ym.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

// ── Currency formatter ────────────────────────────────────────────
const fmtUSD = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

// ── MonthlyLineChart ──────────────────────────────────────────────
// data: [{month:'2026-01', amount:1200}, ...]
// valueKey defaults to 'amount'
export const MonthlyLineChart = ({ data = [], color = CHART_COLORS.primary, valueKey = 'amount', height = 220 }) => {
  const labels  = data.map(d => fmtMonth(d.month));
  const values  = data.map(d => d[valueKey] ?? 0);
  const chartData = {
    labels,
    datasets: [{
      data:            values,
      borderColor:     color,
      backgroundColor: `${color}22`,
      borderWidth:     2.5,
      fill:            true,
      tension:         0.35,
      pointRadius:     values.length > 6 ? 3 : 5,
      pointHoverRadius: 7,
      pointBackgroundColor: color,
    }],
  };
  const opts = {
    ...BASE_OPTS,
    plugins: {
      ...BASE_OPTS.plugins,
      tooltip: {
        ...BASE_OPTS.plugins.tooltip,
        callbacks: {
          label: ctx => fmtUSD(ctx.parsed.y),
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.06)' },
        ticks: { color: '#94a3b8', font: { size: 11 }, callback: v => fmtUSD(v) },
      },
    },
  };
  return (
    <div style={{ height }}>
      <Line data={chartData} options={opts} />
    </div>
  );
};

// ── StatusDonut ───────────────────────────────────────────────────
// statusMap: { open:2, in_progress:3, completed:45, ... }
const STATUS_COLORS = {
  open:          '#3b82f6',
  accepted:      '#8b5cf6',
  pending_start: '#f59e0b',
  in_progress:   '#06b6d4',
  completed:     '#16a34a',
  cancelled:     '#ef4444',
  draft:         '#94a3b8',
};
const STATUS_LABELS = {
  open: 'Open', accepted: 'Accepted', pending_start: 'Pending Start',
  in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled', draft: 'Draft',
};
export const StatusDonut = ({ statusMap = {}, height = 220 }) => {
  const entries = Object.entries(statusMap).filter(([, v]) => v > 0);
  if (!entries.length) return null;
  const chartData = {
    labels: entries.map(([k]) => STATUS_LABELS[k] || k),
    datasets: [{
      data:            entries.map(([, v]) => v),
      backgroundColor: entries.map(([k]) => STATUS_COLORS[k] || '#94a3b8'),
      borderWidth:     2,
      borderColor:     '#fff',
      hoverBorderWidth: 3,
    }],
  };
  const opts = {
    ...BASE_OPTS,
    cutout: '65%',
    plugins: {
      ...BASE_OPTS.plugins,
      legend: { display: true, position: 'right', labels: { boxWidth: 12, font: { size: 11 }, color: '#475569' } },
      tooltip: {
        ...BASE_OPTS.plugins.tooltip,
        callbacks: {
          label: ctx => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            return ` ${ctx.label}: ${ctx.parsed} (${Math.round(ctx.parsed / total * 100)}%)`;
          },
        },
      },
    },
  };
  return (
    <div style={{ height }}>
      <Doughnut data={chartData} options={opts} />
    </div>
  );
};

// ── ProposalFunnelBar ─────────────────────────────────────────────
// funnel: { sent, pending, accepted, declined }
export const ProposalFunnelBar = ({ funnel = {}, height = 180 }) => {
  if (!funnel.sent) return null;
  const labels = ['Sent', 'Pending', 'Accepted', 'Declined'];
  const values = [funnel.sent, funnel.pending, funnel.accepted, funnel.declined];
  const colors = [CHART_COLORS.primary, CHART_COLORS.warning, CHART_COLORS.success, CHART_COLORS.muted];
  const chartData = {
    labels,
    datasets: [{ data: values, backgroundColor: colors, borderRadius: 6, borderSkipped: false }],
  };
  const opts = {
    ...BASE_OPTS,
    indexAxis: 'y',
    plugins: { ...BASE_OPTS.plugins },
    scales: {
      x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#94a3b8', font: { size: 11 } } },
      y: { grid: { display: false }, ticks: { color: '#475569', font: { size: 12 } } },
    },
  };
  return (
    <div style={{ height }}>
      <Bar data={chartData} options={opts} />
    </div>
  );
};

// ── CategoryBar ───────────────────────────────────────────────────
// items: [{category, earned|amount|budgeted|actual, jobs?}, ...]
// valueKeys: array of keys to render as grouped bars
export const CategoryBar = ({ items = [], valueKeys = ['earned'], colors, height = 220 }) => {
  if (!items.length) return null;
  const usedColors = colors || valueKeys.map((_, i) => CHART_COLORS.palette[i]);
  const KEY_LABELS = { earned: 'Earned', spent: 'Spent', budgeted: 'Budget', actual: 'Actual', amount: 'Amount' };
  const chartData = {
    labels: items.map(d => (d.category || 'Other').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())),
    datasets: valueKeys.map((k, i) => ({
      label:           KEY_LABELS[k] || k,
      data:            items.map(d => d[k] ?? 0),
      backgroundColor: usedColors[i],
      borderRadius:    6,
    })),
  };
  const opts = {
    ...BASE_OPTS,
    plugins: {
      ...BASE_OPTS.plugins,
      legend: valueKeys.length > 1
        ? { display: true, labels: { boxWidth: 12, font: { size: 11 }, color: '#475569' } }
        : { display: false },
      tooltip: {
        ...BASE_OPTS.plugins.tooltip,
        callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtUSD(ctx.parsed.y)}` },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#475569', font: { size: 11 } } },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.06)' },
        ticks: { color: '#94a3b8', font: { size: 11 }, callback: v => fmtUSD(v) },
      },
    },
  };
  return (
    <div style={{ height }}>
      <Bar data={chartData} options={opts} />
    </div>
  );
};

// ── RatingLine ────────────────────────────────────────────────────
// trend: [{month, avg, count}, ...]
export const RatingLine = ({ trend = [], height = 180 }) => {
  const withData = trend.filter(d => d.avg != null);
  if (!withData.length) return null;
  const labels = trend.map(d => fmtMonth(d.month));
  const values = trend.map(d => d.avg);
  const chartData = {
    labels,
    datasets: [{
      data:            values,
      borderColor:     CHART_COLORS.warning,
      backgroundColor: `${CHART_COLORS.warning}22`,
      borderWidth:     2.5,
      fill:            true,
      tension:         0.35,
      spanGaps:        true,
      pointRadius:     4,
      pointBackgroundColor: CHART_COLORS.warning,
    }],
  };
  const opts = {
    ...BASE_OPTS,
    plugins: {
      ...BASE_OPTS.plugins,
      tooltip: { ...BASE_OPTS.plugins.tooltip, callbacks: { label: ctx => ` ⭐ ${ctx.parsed.y?.toFixed(1)}` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } },
      y: { min: 1, max: 5, beginAtZero: false, grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { color: '#94a3b8', font: { size: 11 }, stepSize: 1 } },
    },
  };
  return (
    <div style={{ height }}>
      <Line data={chartData} options={opts} />
    </div>
  );
};
