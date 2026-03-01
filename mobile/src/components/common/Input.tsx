import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, TextInputProps, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, MIN_TOUCH_TARGET } from '../../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ComponentProps<typeof Ionicons>['name'];
  rightIcon?: React.ComponentProps<typeof Ionicons>['name'];
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
}

export default function Input({
  label, error, hint, leftIcon, rightIcon,
  onRightIconPress, containerStyle, secureTextEntry, ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const [secure, setSecure] = useState(secureTextEntry ?? false);

  const borderColor = error ? colors.danger : focused ? colors.primary : colors.borderMedium;

  // Auto toggle for password fields
  const isPassword = secureTextEntry === true;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.row, { borderColor }]}>
        {leftIcon && (
          <Ionicons name={leftIcon} size={18} color={colors.textMuted} style={styles.leftIcon} />
        )}
        <TextInput
          {...props}
          secureTextEntry={secure}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, leftIcon && styles.inputWithLeft, (rightIcon || isPassword) && styles.inputWithRight]}
          placeholderTextColor={colors.textMuted}
          autoCapitalize={isPassword ? 'none' : props.autoCapitalize}
          autoCorrect={isPassword ? false : props.autoCorrect}
        />
        {isPassword && (
          <Pressable onPress={() => setSecure(s => !s)} style={styles.rightBtn} hitSlop={8}>
            <Ionicons name={secure ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
          </Pressable>
        )}
        {rightIcon && !isPassword && (
          <Pressable onPress={onRightIconPress} style={styles.rightBtn} hitSlop={8}>
            <Ionicons name={rightIcon} size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { ...typography.label, marginBottom: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: radius.md,
    backgroundColor: colors.white, minHeight: MIN_TOUCH_TARGET,
  },
  input: {
    flex: 1, paddingHorizontal: spacing.md,
    fontSize: 15, color: colors.textDark, paddingVertical: 10,
  },
  inputWithLeft:  { paddingLeft: 6 },
  inputWithRight: { paddingRight: 6 },
  leftIcon:  { marginLeft: spacing.md },
  rightBtn:  { paddingHorizontal: spacing.md, minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
  error:     { color: colors.danger, fontSize: 12, marginTop: 4 },
  hint:      { color: colors.textMuted, fontSize: 12, marginTop: 4 },
});
