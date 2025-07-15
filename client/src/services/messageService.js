import { io } from 'socket.io-client';

const API_BASE_URL = 'http://localhost:10000/api';

class MessageService {
  constructor() {
    this.socket = null;
  }

  connect() {
    const token = localStorage.getItem('token');
    if (!token) return;

    this.socket = io('http://localhost:10000', {
      auth: { token }
    });

    this.socket.on('connect', () => {
      console.log('Connected to messaging server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from messaging server');
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinConversation(conversationId) {
    if (this.socket) {
      this.socket.emit('join_conversation', conversationId);
    }
  }

  sendMessage(conversationId, content) {
    if (this.socket) {
      this.socket.emit('send_message', { conversationId, content });
    }
  }

  onNewMessage(callback) {
    if (this.socket) {
      this.socket.on('new_message', callback);
    }
  }

  async getConversations() {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/messages/conversations`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
  }

  async getMessages(conversationId) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/messages/conversations/${conversationId}/messages`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
  }

  async createConversation(participantId, jobId = null) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/messages/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ participantId, jobId })
    });
    return response.json();
  }

  async sendMessageAPI(conversationId, content) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ conversationId, content })
    });
    return response.json();
  }
}

export default new MessageService();
