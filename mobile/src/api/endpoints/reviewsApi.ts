import client from '../client';

export interface Review {
  _id: string;
  rating: number;
  comment: string;
  reviewer: { firstName: string; lastName: string; avatar?: string };
  createdAt: string;
  response?: { comment: string };
  helpfulCount?: number;
}

export interface CreateReviewPayload {
  rating: number;
  comment: string;
  jobId?: string;
  serviceId?: string;
  orderId?: string;
}

export const reviewsApi = {
  list: (params: { freelancerId?: string; serviceId?: string }): Promise<Review[]> =>
    client.get('/api/reviews', { params }).then(r => r.data),

  create: (data: CreateReviewPayload): Promise<Review> =>
    client.post('/api/reviews', data).then(r => r.data),

  markHelpful: (id: string): Promise<void> =>
    client.post(`/api/reviews/${id}/helpful`).then(r => r.data),
};
