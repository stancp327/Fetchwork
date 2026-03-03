
export const STEPS = ['Details', 'Pricing', 'Media', 'Requirements', 'Review'];

export const SESSION_DURATIONS = [
  { value: 30,  label: '30 minutes' },
  { value: 45,  label: '45 minutes' },
  { value: 60,  label: '1 hour' },
  { value: 90,  label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

export const BILLING_CYCLES = [
  { value: 'per_session', label: 'Per Session' },
  { value: 'weekly',      label: 'Weekly Package' },
  { value: 'monthly',     label: 'Monthly Package' },
];

export const LOCATION_TYPES = [
  { value: 'online',    label: '💻 Online Only' },
  { value: 'in_person', label: '📍 In-Person Only' },
  { value: 'both',      label: '🔀 Online & In-Person' },
];
