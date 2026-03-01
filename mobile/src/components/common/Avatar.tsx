import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, radius } from '../../theme';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_MAP: Record<AvatarSize, number> = {
  xs: 24, sm: 32, md: 40, lg: 56, xl: 80,
};

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: AvatarSize;
  online?: boolean;
}

function getInitials(name = ''): string {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

function getColorForName(name = ''): string {
  const palette = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

export default function Avatar({ uri, name = '', size = 'md', online }: AvatarProps) {
  const dim = SIZE_MAP[size];
  const initials = getInitials(name);
  const bg = getColorForName(name);

  return (
    <View style={{ width: dim, height: dim }}>
      {uri ? (
        <Image source={{ uri }} style={[styles.img, { width: dim, height: dim, borderRadius: dim / 2 }]} />
      ) : (
        <View style={[styles.placeholder, { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: bg }]}>
          <Text style={[styles.initials, { fontSize: dim * 0.38 }]}>{initials || '?'}</Text>
        </View>
      )}
      {online !== undefined && (
        <View style={[styles.dot, online ? styles.dotOnline : styles.dotOffline]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  img:         { resizeMode: 'cover' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  initials:    { color: colors.white, fontWeight: '700' },
  dot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 2, borderColor: colors.white,
  },
  dotOnline:  { backgroundColor: colors.success },
  dotOffline: { backgroundColor: colors.textMuted },
});
