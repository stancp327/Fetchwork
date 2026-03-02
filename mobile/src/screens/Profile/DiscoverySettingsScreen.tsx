import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  Switch, Pressable, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { discoveryApi, DiscoveryPrefs } from '../../api/endpoints/discoveryApi';
import { usersApi } from '../../api/endpoints/usersApi';
import { colors, spacing, typography } from '../../theme';

const CATEGORIES = [
  { id: 'web_development', label: 'Web Dev', icon: '💻' },
  { id: 'design', label: 'Design', icon: '🎨' },
  { id: 'writing', label: 'Writing', icon: '✏️' },
  { id: 'home_repair', label: 'Home Repair', icon: '🔧' },
  { id: 'cleaning', label: 'Cleaning', icon: '🧹' },
  { id: 'pet_care', label: 'Pet Care', icon: '🐾' },
  { id: 'tutoring', label: 'Tutoring', icon: '📖' },
  { id: 'cooking_classes', label: 'Cooking', icon: '👨‍🍳' },
  { id: 'fitness_classes', label: 'Fitness', icon: '💪' },
  { id: 'art_classes', label: 'Art', icon: '🎨' },
  { id: 'music_lessons', label: 'Music', icon: '🎵' },
  { id: 'yoga_meditation', label: 'Yoga', icon: '🧘' },
  { id: 'photography', label: 'Photo', icon: '📷' },
  { id: 'consulting', label: 'Consulting', icon: '💡' },
];

const FREQ_OPTIONS = [
  { value: 'realtime' as const, label: 'Real-time', desc: 'Instant notifications' },
  { value: 'daily' as const, label: 'Daily', desc: 'One digest per day' },
  { value: 'weekly' as const, label: 'Weekly', desc: 'Weekly summary' },
];

export default function DiscoverySettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [prefs, setPrefs]     = useState<DiscoveryPrefs>({
    enabled: false, notifyJobs: true, notifyServices: true,
    notifyClasses: true, categories: [], frequency: 'daily',
  });
  const [interests, setInterests]   = useState('');
  const [lookingFor, setLookingFor] = useState('');

  useEffect(() => {
    discoveryApi.getPrefs().then(res => {
      setPrefs(res.discovery || prefs);
      setInterests((res.interests || []).join(', '));
      setLookingFor((res.lookingFor || []).join(', '));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleCat = (id: string) => {
    setPrefs(p => ({
      ...p,
      categories: p.categories.includes(id)
        ? p.categories.filter(c => c !== id)
        : [...p.categories, id],
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await discoveryApi.updatePrefs(prefs);
      await usersApi.updateProfile({
        interests: interests.split(',').map(s => s.trim()).filter(Boolean),
        lookingFor: lookingFor.split(',').map(s => s.trim()).filter(Boolean),
      });
      Alert.alert('Saved', 'Discovery settings updated');
    } catch {
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Master toggle */}
        <View style={s.section}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.sectionTitle}>Discovery Notifications</Text>
              <Text style={s.hint}>Get notified about jobs and services matching your interests</Text>
            </View>
            <Switch
              value={prefs.enabled}
              onValueChange={v => setPrefs(p => ({ ...p, enabled: v }))}
              trackColor={{ true: colors.primary }}
            />
          </View>
        </View>

        {prefs.enabled && (
          <>
            {/* Type toggles */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Notify me about</Text>
              {[
                { key: 'notifyJobs' as const, label: '💼 Jobs' },
                { key: 'notifyServices' as const, label: '⭐ Services' },
                { key: 'notifyClasses' as const, label: '📚 Classes' },
              ].map(t => (
                <View key={t.key} style={s.toggleRow}>
                  <Text style={s.toggleLabel}>{t.label}</Text>
                  <Switch
                    value={prefs[t.key]}
                    onValueChange={v => setPrefs(p => ({ ...p, [t.key]: v }))}
                    trackColor={{ true: colors.primary }}
                  />
                </View>
              ))}
            </View>

            {/* Frequency */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Frequency</Text>
              <View style={s.freqRow}>
                {FREQ_OPTIONS.map(opt => (
                  <Pressable
                    key={opt.value}
                    style={[s.freqBtn, prefs.frequency === opt.value && s.freqBtnActive]}
                    onPress={() => setPrefs(p => ({ ...p, frequency: opt.value }))}
                  >
                    <Text style={[s.freqLabel, prefs.frequency === opt.value && s.freqLabelActive]}>{opt.label}</Text>
                    <Text style={s.freqDesc}>{opt.desc}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Categories */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>
                Categories {prefs.categories.length > 0 ? `(${prefs.categories.length})` : '(all)'}
              </Text>
              <Text style={s.hint}>Select specific categories or leave empty for all</Text>
              <View style={s.catGrid}>
                {CATEGORIES.map(cat => (
                  <Pressable
                    key={cat.id}
                    style={[s.catBtn, prefs.categories.includes(cat.id) && s.catBtnActive]}
                    onPress={() => toggleCat(cat.id)}
                  >
                    <Text style={s.catIcon}>{cat.icon}</Text>
                    <Text style={[s.catLabel, prefs.categories.includes(cat.id) && s.catLabelActive]}>{cat.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Interests */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Your Interests</Text>
              <Text style={s.hint}>Comma-separated</Text>
              <TextInput
                style={s.input}
                value={interests}
                onChangeText={setInterests}
                placeholder="cooking, web design, fitness"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={[s.fieldLabel, { marginTop: spacing.sm }]}>Looking for</Text>
              <TextInput
                style={s.input}
                value={lookingFor}
                onChangeText={setLookingFor}
                placeholder="personal trainer, house cleaning"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </>
        )}

        <Pressable style={s.saveBtn} onPress={save} disabled={saving}>
          <Text style={s.saveBtnText}>{saving ? 'Saving...' : '💾 Save Settings'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: colors.bgSubtle },
  scroll:     { padding: spacing.md, paddingBottom: 40 },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section:    { backgroundColor: colors.white, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { ...typography.h4, marginBottom: 4 },
  hint:       { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  row:        { flexDirection: 'row', alignItems: 'center' },
  toggleRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs, minHeight: 44 },
  toggleLabel: { ...typography.body, fontSize: 15 },
  freqRow:    { gap: spacing.xs },
  freqBtn:    { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: spacing.sm, marginBottom: spacing.xs },
  freqBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '08' },
  freqLabel:  { ...typography.bodyBold, fontSize: 14 },
  freqLabelActive: { color: colors.primary },
  freqDesc:   { ...typography.caption, color: colors.textMuted },
  catGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  catBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.white, minHeight: 36 },
  catBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  catIcon:    { fontSize: 14 },
  catLabel:   { fontSize: 12, color: colors.textSecondary },
  catLabelActive: { color: colors.primary, fontWeight: '600' },
  fieldLabel: { ...typography.caption, fontWeight: '600', marginBottom: 4 },
  input:      { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: spacing.sm, fontSize: 15, color: colors.textDark, backgroundColor: colors.white, minHeight: 44 },
  saveBtn:    { backgroundColor: colors.primary, borderRadius: 12, padding: spacing.md, alignItems: 'center', minHeight: 48, marginTop: spacing.sm },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
