/** Format date: "Tue, Jun 17" */
export function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Format time range: "5:00 PM – 6:00 PM" */
export function formatTimeRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const sTime = s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const eTime = e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${sTime} – ${eTime}`;
}

/** Human-readable location mode */
export function locationLabel(mode) {
  switch (mode) {
    case 'remote':        return '💻 Online';
    case 'at_freelancer': return '📍 In-person';
    case 'at_client':     return '🚗 At your location';
    case 'flexible':      return '🔄 Flexible';
    default:              return null;
  }
}
