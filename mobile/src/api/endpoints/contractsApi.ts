import client from '../client';

export type ContractParty = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

export type ContractItem = {
  _id: string;
  title: string;
  status: 'draft' | 'pending' | 'active' | 'cancelled' | 'completed';
  createdBy?: string;
  client?: ContractParty;
  freelancer?: ContractParty;
  updatedAt?: string;
  sentAt?: string;
  terms?: { compensation?: number | string };
};

export const contractsApi = {
  getContracts: (status: string = 'all'): Promise<{ contracts: ContractItem[] }> =>
    client.get('/api/contracts', { params: { status } }).then((r) => r.data),

  sendContract: (id: string): Promise<{ message: string; contract: ContractItem }> =>
    client.post(`/api/contracts/${id}/send`).then((r) => r.data),

  signContract: (id: string, name: string): Promise<{ message: string; contract: ContractItem }> =>
    client.post(`/api/contracts/${id}/sign`, { name }).then((r) => r.data),

  cancelContract: (id: string, reason = ''): Promise<{ message: string; contract: ContractItem }> =>
    client.post(`/api/contracts/${id}/cancel`, { reason }).then((r) => r.data),

  getContract: (id: string): Promise<ContractItem & { content?: string; signatures?: unknown[] }> =>
    client.get(`/api/contracts/${id}`).then((r) => r.data),

  createContract: (payload: {
    freelancerId: string;
    title: string;
    template?: string;
    terms?: Record<string, unknown>;
    jobId?: string;
  }): Promise<ContractItem> =>
    client.post('/api/contracts', payload).then((r) => r.data),

  updateContract: (id: string, payload: { title?: string; content?: string; terms?: Record<string, unknown> }): Promise<ContractItem> =>
    client.put(`/api/contracts/${id}`, payload).then((r) => r.data),

  completeContract: (id: string): Promise<{ message: string; contract: ContractItem }> =>
    client.post(`/api/contracts/${id}/complete`).then((r) => r.data),
};
