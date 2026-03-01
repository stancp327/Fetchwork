import { Platform, TextStyle } from 'react-native';

const fontWeightMap: Record<string, TextStyle['fontWeight']> = {
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
};

export const typography: Record<string, TextStyle> = {
  h1:        { fontSize: 28, fontWeight: '700', lineHeight: 34, color: '#111827' },
  h2:        { fontSize: 22, fontWeight: '700', lineHeight: 28, color: '#111827' },
  h3:        { fontSize: 18, fontWeight: '600', lineHeight: 24, color: '#111827' },
  h4:        { fontSize: 16, fontWeight: '600', lineHeight: 22, color: '#111827' },
  body:      { fontSize: 15, fontWeight: '400', lineHeight: 22, color: '#374151' },
  bodySmall: { fontSize: 13, fontWeight: '400', lineHeight: 18, color: '#6b7280' },
  label:     { fontSize: 13, fontWeight: '600', lineHeight: 18, color: '#374151' },
  caption:   { fontSize: 11, fontWeight: '400', lineHeight: 16, color: '#9ca3af' },
  button:    { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  buttonSm:  { fontSize: 13, fontWeight: '600', lineHeight: 18 },
};
