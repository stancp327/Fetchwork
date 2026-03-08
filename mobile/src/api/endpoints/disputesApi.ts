import client from '../client';

export interface DisputeMessage {
  _id: string;
  sender: { _id: string; firstName: string; lastName: string };
  content: string;
  createdAt: string;
}

export interface Dispute {
  _id: string;
  type: 'payment' | 'quality' | 'communication' | 'no_show' | 'other';
  status: 'open' | 'under_review' | 'resolved' | 'closed';
  amount?: number;
  description: string;
  createdAt: string;
  job?: { _id: string; title: string };
  service?: { _id: string; title: string };
  initiator: { _id: string; firstName: string; lastName: string };
  respondent: { _id: string; firstName: string; lastName: string };
  messages?: DisputeMessage[];
  evidence?: string[];
  resolution?: { outcome: string; notes: string };
  isEscalated?: boolean;
}

export type DisputeType = Dispute['type'];

export interface CreateDisputePayload {
  type: Dispute['type'];
  jobId?: string;
  orderId?: string;
  amount?: number;
  description: string;
}

export const disputesApi = {
  list: (): Promise<Dispute[]> =>
    client.get('/api/disputes/user').then(r => Array.isArray(r.data) ? r.data : r.data.disputes ?? []),

  get: (id: string): Promise<Dispute> =>
    client.get(`/api/disputes/${id}`).then(r => r.data),

  create: (data: CreateDisputePayload): Promise<Dispute> =>
    client.post('/api/disputes', data).then(r => r.data),

  sendMessage: (id: string, content: string): Promise<DisputeMessage> =>
    client.post(`/api/disputes/${id}/messages`, { content }).then(r => r.data),

  escalate: (id: string): Promise<void> =>
    client.post(`/api/disputes/${id}/escalate`).then(r => r.data),
};
