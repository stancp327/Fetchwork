export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const;

export const radius = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   20,
  full: 9999,
} as const;

// Minimum touch target (WCAG + Apple HIG)
export const MIN_TOUCH_TARGET = 44;
