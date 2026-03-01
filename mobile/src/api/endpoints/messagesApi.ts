import client from '../client';
import { Conversation, Message } from '@fetchwork/shared';

export const messagesApi = {
  getConversations: (): Promise<Conversation[]> =>
    client.get('/api/messages/conversations').then(r => r.data),

  getMessages: (conversationId: string, params?: { page?: number; limit?: number }): Promise<{
    messages: Message[]; total: number;
  }> =>
    client.get(`/api/messages/conversations/${conversationId}/messages`, { params }).then(r => r.data),

  send: (data: { conversationId?: string; content: string; recipientId?: string }): Promise<Message> =>
    client.post('/api/messages', data).then(r => r.data),

  findOrCreate: (recipientId: string): Promise<{ conversationId: string }> =>
    client.post('/api/messages/conversations/find-or-create', { recipientId }).then(r => r.data),

  markRead: (conversationId: string) =>
    client.put(`/api/messages/conversations/${conversationId}/read`).then(r => r.data),

  getUnreadCount: (): Promise<{ count: number }> =>
    client.get('/api/messages/unread-count').then(r => r.data),
};
