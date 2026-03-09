/**
 * SkillAssessmentScreen
 * Browse assessable categories, take quizzes, earn badges.
 * Navigation: Profile → Skills 🏅
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, FlatList, SafeAreaView, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { skillsApi, SkillCategory, SkillAssessment, SkillQuestion, AssessmentResult } from '../../api/endpoints/skillsApi';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const BADGE_ICONS: Record<string, string> = { gold: '🥇', silver: '🥈', bronze: '🥉' };
const BADGE_LABELS: Record<string, string> = {
  gold: 'Gold (95%+)', silver: 'Silver (88%+)', bronze: 'Bronze (80%+)',
};
const CATEGORY_ICONS: Record<string, string> = {
  web_development: '💻', mobile_development: '📱', design: '🎨',
  writing: '✍️', marketing: '📣', photography: '📸',
  personal_training: '🏋️', tutoring: '📚', cooking_chef: '👨‍🍳', cleaning: '🧹',
};

// ─── Quiz Screen ──────────────────────────────────────────────────────────────
const QuizView: React.FC<{
  category: SkillCategory;
  onDone: (result: AssessmentResult) => void;
  onBack: () => void;
}> = ({ category, onDone, onBack }) => {
  const [questions, setQuestions] = useState<SkillQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    skillsApi.getQuestions(category.id)
      .then(d => setQuestions(d.questions))
      .catch(() => Alert.alert('Error', 'Failed to load questions'))
      .finally(() => setLoading(false));
  }, [category.id]);

  const handleSelect = (optIdx: number) => {
    if (answers[current] !== undefined) return;
    const next = [...answers];
    next[current] = optIdx;
    setAnswers(next);
    setTimeout(() => {
      if (current < questions.length - 1) setCurrent(c => c + 1);
    }, 500);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await skillsApi.submitAssessment(category.id, answers);
      onDone(result);
    } catch {
      Alert.alert('Error', 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.loadingText}>Loading questions…</Text>
    </View>
  );

  if (questions.length === 0) return (
    <View style={styles.center}>
      <Text style={styles.emptyText}>Questions unavailable for this category yet.</Text>
      <TouchableOpacity onPress={onBack} style={styles.btnSecondary}>
        <Text style={styles.btnSecondaryText}>← Back</Text>
      </TouchableOpacity>
    </View>
  );

  const q = questions[current];
  const answered = answers[current];
  const allAnswered = answers.filter(a => a !== undefined).length === questions.length;
  const progress = (current + 1) / questions.length;

  return (
    <ScrollView style={styles.quizWrap} contentContainerStyle={styles.quizContent}>
      {/* Header */}
      <View style={styles.quizHeader}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.exitBtn}>← Exit</Text>
        </TouchableOpacity>
        <Text style={styles.quizCategory}>{category.label}</Text>
        <Text style={styles.quizProgress}>{current + 1} / {questions.length}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
      </View>

      {/* Question */}
      <View style={styles.questionBox}>
        <Text style={styles.questionNum}>Question {current + 1}</Text>
        <Text style={styles.questionText}>{q.q}</Text>

        {q.options.map((opt, i) => {
          const isCorrectAnswer = answered !== undefined && i === q.answer;
          const isWrongAnswer   = answered !== undefined && i === answered && i !== q.answer;
          const isSelected      = answered === undefined ? false : false; // only pre-answer highlight

          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.option,
                isCorrectAnswer && styles.optionCorrect,
                isWrongAnswer   && styles.optionWrong,
              ]}
              onPress={() => handleSelect(i)}
              disabled={answered !== undefined}
              activeOpacity={0.7}
            >
              <View style={styles.optionLetter}>
                <Text style={styles.optionLetterText}>{String.fromCharCode(65 + i)}</Text>
              </View>
              <Text style={[
                styles.optionText,
                isCorrectAnswer && styles.optionCorrectText,
                isWrongAnswer   && styles.optionWrongText,
                { flex: 1 },
              ]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Nav */}
      <View style={styles.quizNav}>
        {current > 0 && (
          <TouchableOpacity style={styles.btnSecondary} onPress={() => setCurrent(c => c - 1)}>
            <Text style={styles.btnSecondaryText}>← Prev</Text>
          </TouchableOpacity>
        )}
        {current < questions.length - 1 ? (
          <TouchableOpacity
            style={[styles.btnPrimary, answered === undefined && styles.btnDisabled]}
            onPress={() => setCurrent(c => c + 1)}
            disabled={answered === undefined}
          >
            <Text style={styles.btnPrimaryText}>Next →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.btnSuccess, (!allAnswered || submitting) && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={!allAnswered || submitting}
          >
            <Text style={styles.btnPrimaryText}>{submitting ? 'Submitting…' : 'Submit Quiz'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

// ─── Result View ──────────────────────────────────────────────────────────────
const ResultView: React.FC<{
  result: AssessmentResult;
  categoryLabel: string;
  onBack: () => void;
  onRetry: () => void;
}> = ({ result, categoryLabel, onBack, onRetry }) => (
  <ScrollView contentContainerStyle={styles.resultWrap}>
    <Text style={styles.resultIcon}>{result.passed ? '🏅' : '📝'}</Text>
    <Text style={styles.resultTitle}>{result.passed ? 'You passed!' : `${result.score}% — Almost!`}</Text>
    <Text style={styles.resultMsg}>{result.message}</Text>

    {result.passed && result.badge?.earned && (
      <View style={styles.resultBadge}>
        <Text style={styles.resultBadgeIcon}>{BADGE_ICONS[result.badge.tier]}</Text>
        <Text style={styles.resultBadgeTier}>{BADGE_LABELS[result.badge.tier]}</Text>
        <Text style={styles.resultBadgeLabel}> • {categoryLabel}</Text>
      </View>
    )}

    {/* Score bar */}
    <View style={styles.breakdownWrap}>
      <Text style={styles.breakdownHeader}>{result.correct} / {result.total} correct ({result.score}%)</Text>
      <View style={styles.breakdownBar}>
        <View style={[
          styles.breakdownFill,
          { width: `${result.score}%` as any, backgroundColor: result.passed ? colors.success : colors.warning }
        ]} />
        {/* Pass marker at 80% */}
        <View style={[styles.passMarker, { left: '80%' as any }]} />
      </View>
      <Text style={styles.breakdownPassLabel}>Pass mark: 80%</Text>
    </View>

    <View style={styles.resultActions}>
      <TouchableOpacity style={styles.btnSecondary} onPress={onBack}>
        <Text style={styles.btnSecondaryText}>← Back to Skills</Text>
      </TouchableOpacity>
      {!result.passed && (
        <TouchableOpacity style={styles.btnPrimary} onPress={onRetry}>
          <Text style={styles.btnPrimaryText}>Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  </ScrollView>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
const SkillAssessmentScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [myAssessments, setMyAssessments] = useState<SkillAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<SkillCategory | null>(null);
  const [quizResult, setQuizResult] = useState<AssessmentResult | null>(null);
  const [tab, setTab] = useState<'browse' | 'mine'>('browse');

  const load = useCallback(async () => {
    try {
      setError(null);
      const [catRes, assRes] = await Promise.all([
        skillsApi.getCategories(),
        user ? skillsApi.getMyAssessments() : Promise.resolve({ assessments: [] }),
      ]);
      setCategories(catRes.categories || []);
      setMyAssessments(assRes.assessments || []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err : new Error('Failed to load'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => { load(); }, [load]);

  const assessmentMap = Object.fromEntries(myAssessments.map(a => [a.category, a]));
  const earned = myAssessments.filter(a => a.passed && a.badge?.earned);

  const handleDone = (result: AssessmentResult) => {
    setQuizResult(result);
    if (user) {
      skillsApi.getMyAssessments().then(r => setMyAssessments(r.assessments || []));
    }
  };

  const startQuiz = (cat: SkillCategory) => {
    if (!user) { navigation.navigate('Login'); return; }
    setQuizResult(null);
    setActiveQuiz(cat);
  };

  // Quiz mode
  if (activeQuiz) {
    if (quizResult) {
      return (
        <ResultView
          result={quizResult}
          categoryLabel={activeQuiz.label}
          onBack={() => { setActiveQuiz(null); setQuizResult(null); }}
          onRetry={() => setQuizResult(null)}
        />
      );
    }
    return (
      <QuizView
        category={activeQuiz}
        onDone={handleDone}
        onBack={() => setActiveQuiz(null)}
      />
    );
  }

  if (loading) return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </SafeAreaView>
  );

  if (error) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Failed to load data</Text>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => { setLoading(true); load(); }}>
            <Text style={styles.btnPrimaryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderCategory = ({ item: cat }: { item: SkillCategory }) => {
    const existing = assessmentMap[cat.id];
    const passed = existing?.passed;
    return (
      <View style={[styles.card, passed && styles.cardPassed]}>
        <Text style={styles.cardIcon}>{CATEGORY_ICONS[cat.id] || '🎓'}</Text>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{cat.label}</Text>
          <Text style={styles.cardMeta}>{cat.questionCount} questions · Pass: {cat.passMark}%</Text>
          {existing && (
            <View style={existing.passed ? styles.passChip : styles.failChip}>
              <Text style={existing.passed ? styles.passChipText : styles.failChipText}>
                {existing.passed
                  ? `${BADGE_ICONS[existing.badge?.tier]} ${existing.badge?.tier} badge`
                  : `Last: ${existing.score}%`}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={passed ? styles.btnSecondary : styles.btnPrimary}
          onPress={() => startQuiz(cat)}
        >
          <Text style={passed ? styles.btnSecondaryText : styles.btnPrimaryText}>
            {passed ? (existing?.score >= 95 ? '✅' : 'Improve') : existing ? 'Retake' : 'Start'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderMyBadge = ({ item: a }: { item: SkillAssessment }) => (
    <View style={[styles.card, a.passed && styles.cardPassed]}>
      <Text style={styles.cardIcon}>{CATEGORY_ICONS[a.category] || '🎓'}</Text>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{a.categoryLabel}</Text>
        {a.passed ? (
          <View style={styles.passChip}>
            <Text style={styles.passChipText}>{BADGE_ICONS[a.badge?.tier]} {BADGE_LABELS[a.badge?.tier]}</Text>
          </View>
        ) : (
          <View style={styles.failChip}>
            <Text style={styles.failChipText}>Score: {a.score}% (need 80%)</Text>
          </View>
        )}
        <Text style={styles.attemptsText}>{a.attempts} attempt{a.attempts !== 1 ? 's' : ''}</Text>
      </View>
      <TouchableOpacity style={styles.btnSecondary} onPress={() => startQuiz({ id: a.category, label: a.categoryLabel, questionCount: a.totalQ, passMark: 80 })}>
        <Text style={styles.btnSecondaryText}>{a.passed && a.score < 95 ? 'Improve' : 'Retake'}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.screen}>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Skill Assessments</Text>
        <Text style={styles.heroSub}>Pass tests · Earn badges · Build trust with clients</Text>
        {earned.length > 0 && (
          <View style={styles.earnedRow}>
            {earned.slice(0, 4).map(a => (
              <View key={a.category} style={[
                styles.miniChip,
                a.badge?.tier === 'gold' ? styles.chip_gold : a.badge?.tier === 'silver' ? styles.chip_silver : styles.chip_bronze,
              ]}>
                <Text style={styles.miniChipText}>{BADGE_ICONS[a.badge?.tier ?? 'bronze']} {a.categoryLabel}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Tabs */}
      {user && (
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'browse' && styles.tabActive]}
            onPress={() => setTab('browse')}
          >
            <Text style={[styles.tabText, tab === 'browse' && styles.tabTextActive]}>Browse Tests</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'mine' && styles.tabActive]}
            onPress={() => setTab('mine')}
          >
            <Text style={[styles.tabText, tab === 'mine' && styles.tabTextActive]}>
              My Badges{earned.length > 0 ? ` (${earned.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {tab === 'mine' ? (
        <FlatList<SkillAssessment>
          data={myAssessments}
          keyExtractor={(item) => item.category}
          renderItem={renderMyBadge}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🏅</Text>
              <Text style={styles.emptyText}>No assessments yet. Take a test to earn your first badge!</Text>
              <TouchableOpacity style={styles.btnPrimary} onPress={() => setTab('browse')}>
                <Text style={styles.btnPrimaryText}>Browse Tests</Text>
              </TouchableOpacity>
            </View>
          }
        />
      ) : (
        <FlatList<SkillCategory>
          data={categories}
          keyExtractor={(item) => item.id}
          renderItem={renderCategory}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  errorText: { ...typography.bodySmall, color: colors.danger },
  loadingText: { ...typography.body, color: colors.textSecondary },

  // Hero
  hero: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  heroTitle: { ...typography.h2, color: '#fff', marginBottom: 4 },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  earnedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },

  // Tabs
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: colors.primary, fontWeight: '700' },

  // List
  list: { padding: spacing.md, gap: spacing.sm },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPassed: { borderColor: colors.success || '#16a34a', backgroundColor: '#f0fdf4' },
  cardIcon: { fontSize: 28, width: 36, textAlign: 'center' },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { ...typography.body, fontWeight: '700', color: colors.text },
  cardMeta: { fontSize: 12, color: colors.textSecondary },
  attemptsText: { fontSize: 12, color: colors.textSecondary },

  // Chips
  passChip: { alignSelf: 'flex-start', backgroundColor: '#dcfce7', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  passChipText: { fontSize: 12, fontWeight: '600', color: '#16a34a' },
  failChip: { alignSelf: 'flex-start', backgroundColor: '#fef3c7', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  failChipText: { fontSize: 12, fontWeight: '600', color: '#d97706' },

  miniChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  chip_bronze: { backgroundColor: 'rgba(255,255,255,0.2)' },
  chip_silver: { backgroundColor: 'rgba(255,255,255,0.15)' },
  chip_gold:   { backgroundColor: 'rgba(255,220,50,0.25)' },
  miniChipText: { fontSize: 11, color: '#fff', fontWeight: '600' },

  // Buttons
  btnPrimary: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnSecondary: {
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  btnSecondaryText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  btnSuccess: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.45 },

  // Empty
  emptyBox: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.md },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', maxWidth: 280 },

  // Quiz
  quizWrap: { flex: 1, backgroundColor: colors.background },
  quizContent: { paddingBottom: spacing.xl },
  quizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  exitBtn: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  quizCategory: { fontWeight: '700', fontSize: 14, color: colors.text },
  quizProgress: { fontSize: 13, color: colors.textSecondary },
  progressBar: {
    height: 3,
    backgroundColor: colors.border,
  },
  progressFill: {
    height: 3,
    backgroundColor: colors.primary,
  },
  questionBox: { padding: spacing.lg, gap: spacing.sm },
  questionNum: { fontSize: 12, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.8 },
  questionText: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 10,
    marginBottom: 8,
  },
  optionCorrect: { borderColor: '#16a34a', backgroundColor: '#dcfce7' },
  optionCorrectText: { color: '#15803d' },
  optionWrong: { borderColor: '#ef4444', backgroundColor: '#fee2e2' },
  optionWrongText: { color: '#dc2626' },
  optionSelected: { borderColor: colors.primary, backgroundColor: '#eff6ff' },
  optionLetter: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  optionLetterText: { fontSize: 12, fontWeight: '700', color: colors.text },
  optionText: { fontSize: 14, color: colors.text, flex: 1 },
  quizNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    gap: spacing.sm,
  },

  // Result
  resultWrap: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  resultIcon: { fontSize: 56 },
  resultTitle: { ...typography.h2, color: colors.text, textAlign: 'center' },
  resultMsg: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: '#16a34a',
  },
  resultBadgeIcon: { fontSize: 22, marginRight: 4 },
  resultBadgeTier: { fontSize: 14, fontWeight: '700', color: '#15803d' },
  resultBadgeLabel: { fontSize: 13, color: '#15803d' },
  breakdownWrap: { width: '100%', gap: 6 },
  breakdownHeader: { fontSize: 14, fontWeight: '600', color: colors.text, textAlign: 'center' },
  breakdownBar: {
    height: 10, backgroundColor: colors.border, borderRadius: 999, overflow: 'hidden', position: 'relative',
  },
  breakdownFill: { height: 10, borderRadius: 999 },
  passMarker: {
    position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#16a34a',
  },
  breakdownPassLabel: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  resultActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
});

export default SkillAssessmentScreen;
