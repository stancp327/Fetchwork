export type JobStatus = 'draft' | 'open' | 'accepted' | 'pending_start' | 'in_progress' | 'completed';
export type BudgetType = 'fixed' | 'hourly';

export interface JobBudget {
  type: BudgetType;
  amount: number;
  max?: number;
}

export interface JobUser {
  _id: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
  rating?: number;
}

export interface Job {
  _id: string;
  title: string;
  description: string;
  category: string;
  skills: string[];
  budget: JobBudget;
  status: JobStatus;
  client: JobUser;
  freelancer?: JobUser;
  proposalCount?: number;
  location?: string;
  isRemote?: boolean;
  isFeatured?: boolean;
  recurring?: {
    enabled: boolean;
    interval?: string;
    nextRunDate?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Proposal {
  _id: string;
  job: { _id: string; title: string; budget: JobBudget };
  freelancer: JobUser & { totalReviews?: number };
  coverLetter: string;
  bidAmount: number;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  milestones?: Array<{ title: string; amount: number; dueDate?: string }>;
  createdAt: string;
}
