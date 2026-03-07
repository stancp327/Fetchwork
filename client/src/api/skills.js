import { apiRequest } from '../utils/api';

export const skillsApi = {
  getCategories: () => apiRequest('/api/skills/categories'),
  getMyAssessments: () => apiRequest('/api/skills/my-assessments'),
  getUserAssessments: (userId) => apiRequest(`/api/skills/user/${userId}`),
  submitAssessment: (category, answers) =>
    apiRequest(`/api/skills/assess/${category}`, { method: 'POST', body: JSON.stringify({ answers }) }),
  getPricingInsights: (category, subcategory) => {
    const params = new URLSearchParams({ category });
    if (subcategory) params.append('subcategory', subcategory);
    return apiRequest(`/api/skills/pricing-insights?${params}`);
  },
  getBudgetInsights: (category) =>
    apiRequest(`/api/skills/budget-insights?category=${encodeURIComponent(category)}`),
};
