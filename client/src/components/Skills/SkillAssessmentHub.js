/**
 * SkillAssessmentHub
 * Route: /skills
 * Freelancers browse skill categories, take quizzes, earn badges.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { skillsApi } from '../../api/skills';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import './SkillAssessmentHub.css';

const BADGE_ICONS = { gold: '🥇', silver: '🥈', bronze: '🥉' };
const BADGE_LABELS = { gold: 'Gold (95%+)', silver: 'Silver (88%+)', bronze: 'Bronze (80%+)' };

const CATEGORY_ICONS = {
  web_development: '💻',
  mobile_development: '📱',
  design: '🎨',
  writing: '✍️',
  marketing: '📣',
  photography: '📸',
  personal_training: '🏋️',
  tutoring: '📚',
  cooking_chef: '👨‍🍳',
  cleaning: '🧹',
};

// ─── Quiz Component ───────────────────────────────────────────────────────────
const Quiz = ({ category, categoryLabel, onComplete, onBack }) => {
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiRequest(`/api/skills/questions/${category}`)
      .then(data => { if (data.questions) setQuestions(data.questions); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category]);

  const handleSelect = (optionIdx) => {
    if (answers[current] !== undefined) return; // already answered
    const newAnswers = [...answers];
    newAnswers[current] = optionIdx;
    setAnswers(newAnswers);

    // Auto-advance after 600ms
    setTimeout(() => {
      if (current < questions.length - 1) {
        setCurrent(c => c + 1);
      }
    }, 600);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await skillsApi.submitAssessment(category, answers);
      setResult(res);
      onComplete?.(res);
    } catch (err) {
      alert('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="sah-quiz-loading">Loading questions…</div>;

  if (questions.length === 0) {
    return (
      <div className="sah-quiz-empty">
        <p>Questions not available yet for this category.</p>
        <button className="sah-btn sah-btn--secondary" onClick={onBack}>← Back</button>
      </div>
    );
  }

  if (result) {
    return (
      <div className={`sah-result ${result.passed ? 'sah-result--pass' : 'sah-result--fail'}`}>
        <div className="sah-result-icon">{result.passed ? '🏅' : '📝'}</div>
        <h2 className="sah-result-title">
          {result.passed ? 'You passed!' : `${result.score}% — Almost!`}
        </h2>
        <p className="sah-result-msg">{result.message}</p>

        {result.passed && result.badge?.earned && (
          <div className="sah-result-badge">
            <span className="sah-badge-icon">{BADGE_ICONS[result.badge.tier]}</span>
            <span className="sah-badge-tier">{BADGE_LABELS[result.badge.tier]}</span>
            <span className="sah-badge-label">{categoryLabel} Badge</span>
          </div>
        )}

        {/* Breakdown */}
        <div className="sah-breakdown">
          <div className="sah-breakdown-header">
            {result.correct} / {result.total} correct ({result.score}%)
          </div>
          <div className="sah-breakdown-bar">
            <div
              className={`sah-breakdown-fill ${result.passed ? 'sah-breakdown-fill--pass' : 'sah-breakdown-fill--fail'}`}
              style={{ width: `${result.score}%` }}
            />
          </div>
          <div className="sah-breakdown-legend">
            <span>0%</span>
            <span className="sah-breakdown-pass-mark">Pass: 80%</span>
            <span>100%</span>
          </div>
        </div>

        <div className="sah-result-actions">
          <button className="sah-btn sah-btn--secondary" onClick={onBack}>← Back to Skills</button>
          {!result.passed && (
            <button className="sah-btn sah-btn--primary" onClick={() => {
              setResult(null); setCurrent(0); setAnswers([]);
            }}>
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  const q = questions[current];
  const answered = answers[current];
  const allAnswered = answers.filter(a => a !== undefined).length === questions.length;

  return (
    <div className="sah-quiz">
      {/* Header */}
      <div className="sah-quiz-header">
        <button className="sah-btn-link" onClick={onBack}>← Exit</button>
        <span className="sah-quiz-category">{categoryLabel}</span>
        <span className="sah-quiz-progress">{current + 1} / {questions.length}</span>
      </div>

      {/* Progress bar */}
      <div className="sah-progress-bar">
        <div
          className="sah-progress-fill"
          style={{ width: `${((current + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="sah-question">
        <div className="sah-question-number">Question {current + 1}</div>
        <h3 className="sah-question-text">{q.q}</h3>

        <div className="sah-options">
          {q.options.map((opt, i) => {
            let cls = 'sah-option';
            if (answered !== undefined) {
              if (i === q.answer) cls += ' sah-option--correct';
              else if (i === answered && i !== q.answer) cls += ' sah-option--wrong';
            } else if (i === answered) {
              cls += ' sah-option--selected';
            }
            return (
              <button key={i} className={cls} onClick={() => handleSelect(i)} disabled={answered !== undefined}>
                <span className="sah-option-letter">{String.fromCharCode(65 + i)}</span>
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="sah-quiz-nav">
        {current > 0 && (
          <button className="sah-btn sah-btn--secondary" onClick={() => setCurrent(c => c - 1)}>
            ← Prev
          </button>
        )}
        {current < questions.length - 1 ? (
          <button
            className="sah-btn sah-btn--primary"
            onClick={() => setCurrent(c => c + 1)}
            disabled={answered === undefined}
          >
            Next →
          </button>
        ) : (
          <button
            className="sah-btn sah-btn--success"
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
          >
            {submitting ? 'Submitting…' : 'Submit Quiz'}
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Badge display ────────────────────────────────────────────────────────────
export const SkillBadge = ({ assessment, size = 'md' }) => (
  <div className={`sah-skill-badge sah-skill-badge--${size} sah-skill-badge--${assessment.badge?.tier || 'bronze'}`}>
    <span className="sah-skill-badge-icon">{BADGE_ICONS[assessment.badge?.tier || 'bronze']}</span>
    <span className="sah-skill-badge-label">{assessment.categoryLabel}</span>
    {size !== 'sm' && (
      <span className="sah-skill-badge-score">{assessment.score}%</span>
    )}
  </div>
);

// ─── Main Hub ─────────────────────────────────────────────────────────────────
const SkillAssessmentHub = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [myAssessments, setMyAssessments] = useState([]);
  const [activeQuiz, setActiveQuiz] = useState(null); // { id, label }
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('browse'); // 'browse' | 'mine'

  const load = useCallback(async () => {
    try {
      const [catRes, assRes] = await Promise.all([
        skillsApi.getCategories(),
        user ? skillsApi.getMyAssessments() : Promise.resolve({ assessments: [] }),
      ]);
      setCategories(catRes.categories || []);
      setMyAssessments(assRes.assessments || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const assessmentMap = Object.fromEntries(myAssessments.map(a => [a.category, a]));

  const handleComplete = (result) => {
    // Reload assessments after completion
    if (user) {
      skillsApi.getMyAssessments().then(r => setMyAssessments(r.assessments || []));
    }
  };

  if (activeQuiz) {
    return (
      <div className="sah-page">
        <Quiz
          category={activeQuiz.id}
          categoryLabel={activeQuiz.label}
          onComplete={handleComplete}
          onBack={() => setActiveQuiz(null)}
        />
      </div>
    );
  }

  const earned = myAssessments.filter(a => a.passed && a.badge?.earned);

  return (
    <div className="sah-page">
      <SEO title="Skill Assessments | Fetchwork" />

      <div className="sah-hero">
        <h1 className="sah-hero-title">Skill Assessments</h1>
        <p className="sah-hero-sub">
          Prove your expertise. Earn verified badges that appear on your profile and boost client trust.
        </p>
        {earned.length > 0 && (
          <div className="sah-earned-preview">
            {earned.slice(0, 5).map(a => (
              <SkillBadge key={a.category} assessment={a} size="sm" />
            ))}
            {earned.length > 5 && <span className="sah-earned-more">+{earned.length - 5} more</span>}
          </div>
        )}
      </div>

      {/* Tabs */}
      {user && (
        <div className="sah-tabs">
          <button
            className={`sah-tab ${tab === 'browse' ? 'sah-tab--active' : ''}`}
            onClick={() => setTab('browse')}
          >
            Browse Tests
          </button>
          <button
            className={`sah-tab ${tab === 'mine' ? 'sah-tab--active' : ''}`}
            onClick={() => setTab('mine')}
          >
            My Badges {earned.length > 0 && <span className="sah-tab-count">{earned.length}</span>}
          </button>
        </div>
      )}

      {loading ? (
        <div className="sah-loading">Loading…</div>
      ) : tab === 'mine' ? (
        <div className="sah-mine">
          {myAssessments.length === 0 ? (
            <div className="sah-empty">
              <span className="sah-empty-icon">🏅</span>
              <p>No assessments taken yet. Take a test to earn your first badge!</p>
              <button className="sah-btn sah-btn--primary" onClick={() => setTab('browse')}>
                Browse Tests
              </button>
            </div>
          ) : (
            <div className="sah-grid">
              {myAssessments.map(a => (
                <div key={a.category} className={`sah-card ${a.passed ? 'sah-card--passed' : 'sah-card--failed'}`}>
                  <div className="sah-card-icon">{CATEGORY_ICONS[a.category] || '🎓'}</div>
                  <div className="sah-card-body">
                    <div className="sah-card-title">{a.categoryLabel}</div>
                    <div className="sah-card-score">
                      {a.passed ? (
                        <span className="sah-pass-chip">
                          {BADGE_ICONS[a.badge?.tier]} {BADGE_LABELS[a.badge?.tier]}
                        </span>
                      ) : (
                        <span className="sah-fail-chip">Score: {a.score}% (need 80%)</span>
                      )}
                    </div>
                    <div className="sah-card-attempts">{a.attempts} attempt{a.attempts !== 1 ? 's' : ''}</div>
                  </div>
                  <button
                    className="sah-btn sah-btn--secondary sah-card-btn"
                    onClick={() => setActiveQuiz({ id: a.category, label: a.categoryLabel })}
                  >
                    {a.passed && a.score < 95 ? 'Improve ↑' : 'Retake'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="sah-grid">
          {categories.map(cat => {
            const existing = assessmentMap[cat.id];
            const passed = existing?.passed;
            const tier = existing?.badge?.tier;
            return (
              <div key={cat.id} className={`sah-card ${passed ? 'sah-card--passed' : ''}`}>
                <div className="sah-card-icon">{CATEGORY_ICONS[cat.id] || '🎓'}</div>
                <div className="sah-card-body">
                  <div className="sah-card-title">{cat.label}</div>
                  <div className="sah-card-meta">{cat.questionCount} questions · Pass: {cat.passMark}%</div>
                  {existing && (
                    <div className="sah-card-score">
                      {passed
                        ? <span className="sah-pass-chip">{BADGE_ICONS[tier]} {tier?.charAt(0).toUpperCase() + tier?.slice(1)} badge</span>
                        : <span className="sah-fail-chip">Last score: {existing.score}%</span>
                      }
                    </div>
                  )}
                </div>
                <button
                  className={`sah-btn ${passed ? 'sah-btn--secondary' : 'sah-btn--primary'} sah-card-btn`}
                  onClick={() => {
                    if (!user) { window.location.href = '/login'; return; }
                    setActiveQuiz({ id: cat.id, label: cat.label });
                  }}
                >
                  {passed ? (existing.score >= 95 ? '✅ Perfect' : 'Improve ↑') : existing ? 'Retake' : 'Start Test'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SkillAssessmentHub;
