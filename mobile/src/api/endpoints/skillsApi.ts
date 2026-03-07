import apiClient from '../client';

export interface SkillCategory {
  id: string;
  label: string;
  questionCount: number;
  passMark: number;
}

export interface SkillQuestion {
  id: string;
  q: string;
  options: string[];
}

export interface SkillBadge {
  earned: boolean;
  tier: 'bronze' | 'silver' | 'gold';
  awardedAt?: string;
}

export interface SkillAssessment {
  category: string;
  categoryLabel: string;
  score: number;
  passed: boolean;
  totalQ: number;
  correctQ: number;
  attempts: number;
  badge: SkillBadge;
  completedAt: string;
  lastAttemptAt: string;
}

export interface AssessmentResult {
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  badge: SkillBadge;
  message: string;
  breakdown: Array<{ id: string; correct: boolean; correctAnswer: number; yourAnswer: number }>;
}

export interface PricingInsights {
  category: string;
  subcategory?: string;
  count: number;
  insufficient?: boolean;
  message?: string;
  min?: number;
  p25?: number;
  median?: number;
  p75?: number;
  max?: number;
  avg?: number;
}

export const skillsApi = {
  getCategories: (): Promise<{ categories: SkillCategory[] }> =>
    apiClient.get('/skills/categories').then(r => r.data),

  getQuestions: (category: string): Promise<{ questions: SkillQuestion[]; label: string }> =>
    apiClient.get(`/skills/questions/${category}`).then(r => r.data),

  getMyAssessments: (): Promise<{ assessments: SkillAssessment[] }> =>
    apiClient.get('/skills/my-assessments').then(r => r.data),

  getUserAssessments: (userId: string): Promise<{ assessments: SkillAssessment[] }> =>
    apiClient.get(`/skills/user/${userId}`).then(r => r.data),

  submitAssessment: (category: string, answers: number[]): Promise<AssessmentResult> =>
    apiClient.post(`/skills/assess/${category}`, { answers }).then(r => r.data),

  getPricingInsights: (category: string, subcategory?: string): Promise<PricingInsights> => {
    const params = new URLSearchParams({ category });
    if (subcategory) params.append('subcategory', subcategory);
    return apiClient.get(`/skills/pricing-insights?${params}`).then(r => r.data);
  },

  getBudgetInsights: (category: string): Promise<PricingInsights> =>
    apiClient.get(`/skills/budget-insights?category=${encodeURIComponent(category)}`).then(r => r.data),
};
