import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme';

/**
 * Shared styles used across multiple screens.
 * Extract repeated patterns here to reduce duplication and bundle size.
 */
export const sharedStyles = StyleSheet.create({
  // Layout
  flex1:             { flex: 1 },
  safeArea:          { flex: 1, backgroundColor: colors.bgSubtle },
  center:            { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollPadding:     { padding: spacing.md },

  // Spacing helpers
  bottomSpacer:      { height: spacing.xl },

  // Error states
  errorText:         { ...typography.bodySmall, color: colors.danger },

  // Common list styles
  listContent:       { padding: spacing.md, paddingBottom: 80 },
});
