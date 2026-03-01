// Mirrors web CSS variables from client/src/styles/tokens.css
export const colors = {
  // Primary — --color-primary: #2563eb
  primary:       '#2563eb',
  primaryLight:  '#eff6ff',
  primaryDark:   '#1d4ed8',

  // Semantic
  success:       '#059669',
  successLight:  '#ecfdf5',
  successDark:   '#047857',
  danger:        '#dc2626',
  dangerLight:   '#fef2f2',
  warning:       '#d97706',
  warningLight:  '#fffbeb',
  purple:        '#7c3aed',
  purpleLight:   '#f5f3ff',

  // Text
  textDark:      '#111827',
  text:          '#374151',
  textSecondary: '#6b7280',
  textMuted:     '#9ca3af',

  // Backgrounds
  white:         '#ffffff',
  bgSubtle:      '#f9fafb',
  bgMuted:       '#f3f4f6',
  bgCard:        '#ffffff',

  // Borders
  border:        '#e5e7eb',
  borderMedium:  '#d1d5db',

  // Trust badge colors
  emailVerified: '#2563eb',
  idVerified:    '#059669',
  topRated:      '#d97706',
  bgChecked:     '#7c3aed',
} as const;

export type ColorKey = keyof typeof colors;
