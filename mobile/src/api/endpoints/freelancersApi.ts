import client from '../client';
import { User } from '@fetchwork/shared';

export interface FreelancerFilters {
  search?: string;
  category?: string;
  sortBy?: 'rating' | 'reviewCount' | 'hourlyRate_asc' | 'hourlyRate_desc';
  page?: number;
  limit?: number;
}

export interface FreelancerListItem {
  _id: string;
  firstName: string;
  lastName: string;
  username?: string;
  skills: string[];
  hourlyRate?: number;
  rating: number;
  reviewCount: number;
  location?: { city?: string; country?: string };
  profilePicture?: string;
  isOnline: boolean;
  headline?: string;
}

export interface FreelancerProfile extends User {
  username?: string;
  isOnline?: boolean;
  services?: {
    _id: string;
    title: string;
    pricing?: { basic?: { price: number } };
    serviceType?: string;
  }[];
  portfolio?: { _id: string; title: string; imageUrl?: string; description?: string }[];
}

export interface FreelancerReview {
  _id: string;
  rating: number;
  comment: string;
  client: { _id: string; firstName: string; lastName: string; profilePicture?: string };
  createdAt: string;
}

export const freelancersApi = {
  browse: (filters: FreelancerFilters = {}): Promise<{
    freelancers: FreelancerListItem[];
    total: number;
    page: number;
    pages: number;
  }> =>
    client.get('/api/freelancers', { params: { limit: 20, ...filters } }).then(r => r.data),

  getById: (id: string): Promise<FreelancerProfile> =>
    client.get(`/api/freelancers/${id}`).then(r => r.data),

  getByUsername: (username: string): Promise<FreelancerProfile> =>
    client.get(`/api/public-profiles/${username}`).then(r => r.data),

  getReviews: (freelancerId: string, limit = 5): Promise<{
    reviews: FreelancerReview[];
    total: number;
  }> =>
    client.get('/api/reviews', { params: { freelancerId, limit } }).then(r => r.data),
};
