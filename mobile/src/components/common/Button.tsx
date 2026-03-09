import React from 'react';
import {
  Pressable, Text, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle, StyleProp,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, MIN_TOUCH_TARGET } from '../../theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: TextStyle;
  leftIcon?: React.ComponentProps<typeof Ionicons>['name'];
  testID?: string;
  accessibilityLabel?: string;
}

const VARIANT_STYLES: Record<Variant, { container: ViewStyle; text: TextStyle }> = {
  primary:   { container: { backgroundColor: colors.primary,     borderWidth: 0 },       text: { color: colors.white } },
  secondary: { container: { backgroundColor: colors.white,       borderColor: colors.borderMedium, borderWidth: 1 }, text: { color: colors.text } },
  danger:    { container: { backgroundColor: colors.danger,      borderWidth: 0 },       text: { color: colors.white } },
  success:   { container: { backgroundColor: colors.success,     borderWidth: 0 },       text: { color: colors.white } },
  ghost:     { container: { backgroundColor: 'transparent',      borderWidth: 0 },       text: { color: colors.primary } },
};

const SIZE_STYLES: Record<Size, { container: ViewStyle; text: TextStyle }> = {
  sm: { container: { paddingHorizontal: spacing.md,  minHeight: 36,               borderRadius: radius.md }, text: { fontSize: 13, fontWeight: '600' } },
  md: { container: { paddingHorizontal: spacing.lg,  minHeight: MIN_TOUCH_TARGET, borderRadius: radius.md }, text: { fontSize: 15, fontWeight: '600' } },
  lg: { container: { paddingHorizontal: spacing.xl,  minHeight: 52,               borderRadius: radius.lg }, text: { fontSize: 16, fontWeight: '700' } },
};

export default React.memo(function Button({
  label, onPress, variant = 'primary', size = 'md',
  loading = false, disabled = false, fullWidth = false,
  style, labelStyle, leftIcon, testID, accessibilityLabel,
}: ButtonProps) {
  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];
  const isDisabled = disabled || loading;
  const iconColor = labelStyle?.color as string || (variant === 'secondary' || variant === 'ghost' ? colors.primary : colors.white);

  return (
    <Pressable
      testID={testID}
      accessibilityLabel={accessibilityLabel || label}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        v.container,
        s.container,
        fullWidth && styles.fullWidth,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'secondary' || variant === 'ghost' ? colors.primary : colors.white} />
      ) : (
        <>
          {leftIcon && <Ionicons name={leftIcon} size={18} color={iconColor} style={{ marginRight: 8 }} />}
          <Text style={[styles.label, v.text, s.text, labelStyle]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  fullWidth: { width: '100%' },
  pressed:   { opacity: 0.8 },
  disabled:  { opacity: 0.5 },
  label:     { textAlign: 'center' },
});
