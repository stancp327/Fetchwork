import client from '../client';

export interface GenerateDescriptionParams {
  title:           string;
  category:        string;
  skills?:         string;
  budgetType?:     string;
  budgetAmount?:   number;
  duration?:       string;
  experienceLevel?: string;
}

export interface GenerateDescriptionResult {
  description:  string;
  aiGenerated:  boolean;
}

export interface MatchCandidate {
  userId:           string;
  name:             string;
  profilePicture:   string;
  skills:           string[];
  bio:              string;
  rating:           number;
  totalReviews:     number;
  completedJobs:    number;
  hourlyRate:       number;
  verificationLevel: string;
  algorithmicScore: number;
  matchReason:      string | null;
  aiScore:          number | null;
}

export interface MatchResult {
  matches:   MatchCandidate[];
  total:     number;
  aiPowered: boolean;
}

export const aiApi = {
  generateDescription: (data: GenerateDescriptionParams): Promise<GenerateDescriptionResult> =>
    client.post('/api/ai/generate-description', data).then(r => r.data),

  matchFreelancers: (jobId: string): Promise<MatchResult> =>
    client.get(`/api/ai/match-freelancers/${jobId}`).then(r => r.data),
};
