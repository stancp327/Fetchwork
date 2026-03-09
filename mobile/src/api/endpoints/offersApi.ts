import client from '../client';

export interface OfferUser {
  _id: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
}

export interface OfferTerms {
  amount: number;
  currency: string;
  deliveryTime: number;
  deadline?: string;
  description: string;
  revisions: number;
  milestones?: Array<{ title: string; amount: number; deadline?: string }>;
}

export interface Offer {
  _id: string;
  sender: OfferUser;
  recipient: OfferUser;
  job?: { _id: string; title: string; budget?: { amount: number } };
  service?: { _id: string; title: string };
  offerType: string;
  terms: OfferTerms;
  status: 'pending' | 'countered' | 'accepted' | 'declined' | 'withdrawn' | 'expired';
  awaitingResponseFrom?: string;
  revisionHistory?: Array<{
    by: OfferUser | string;
    terms: OfferTerms;
    message?: string;
    action: string;
    createdAt?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface OfferListResponse {
  offers: Offer[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export const offersApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: 'sent' | 'received' | 'action_needed' | 'all';
  }): Promise<OfferListResponse> =>
    client.get('/api/offers', { params }).then(r => r.data),

  getById: (id: string): Promise<{ offer: Offer }> =>
    client.get(`/api/offers/${id}`).then(r => r.data),

  accept: (id: string): Promise<{ message: string; offer: Offer }> =>
    client.post(`/api/offers/${id}/accept`).then(r => r.data),

  decline: (id: string, message?: string): Promise<{ message: string; offer: Offer }> =>
    client.post(`/api/offers/${id}/decline`, { message }).then(r => r.data),

  counter: (
    id: string,
    terms: OfferTerms,
    message?: string,
  ): Promise<{ message: string; offer: Offer }> =>
    client.post(`/api/offers/${id}/counter`, { terms, message }).then(r => r.data),

  withdraw: (id: string): Promise<{ message: string; offer: Offer }> =>
    client.post(`/api/offers/${id}/withdraw`).then(r => r.data),
};
