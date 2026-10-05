import Cookies from 'js-cookie';
import {
  ApiResponse,
  Conversation,
  Message,
  PaginatedResponse,
  SendMessageRequest,
  User,
} from './types';

const API_BASE_URL = "https://uatapi.garage.app";

class ChatAPI {
  private getAuthHeaders(): HeadersInit {
    let authToken: string | null = null;

    if (typeof window !== 'undefined') {
      authToken = localStorage.getItem('auth-token');
    }

    if (!authToken) {
      authToken = Cookies.get('auth-token') || null;
    }

    const headers: HeadersInit = { 'Content-Type': 'application/json' };

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    return headers;
  }

  async getConversation(conversationId: string): Promise<Conversation> {
    const response = await fetch(`${API_BASE_URL}/api/chat/conversations/${conversationId}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch conversation: ${response.statusText}`);
    }

    const result: ApiResponse<Conversation> = await response.json();
    return result.data;
  }

  async getMessages(conversationId: string, limit: number = 50, skip: number = 0): Promise<PaginatedResponse<Message>> {
    const url = new URL(`${API_BASE_URL}/api/chat/conversations/${conversationId}/messages`);
    url.searchParams.append('limit', limit.toString());
    url.searchParams.append('skip', skip.toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch messages: ${response.statusText}`);
    }

    return await response.json();
  }

  async sendMessage(conversationId: string, content: string, type: string = 'text', replyTo?: string): Promise<Message> {
    const response = await fetch(`${API_BASE_URL}/api/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        content,
        type,
        replyTo,
      } as SendMessageRequest),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }

    const result: ApiResponse<Message> = await response.json();
    return result.data;
  }

  async editMessage(conversationId: string, messageId: string, content: string): Promise<Message> {
    const response = await fetch(`${API_BASE_URL}/api/chat/conversations/${conversationId}/messages/${messageId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      throw new Error(`Failed to edit message: ${response.statusText}`);
    }

    const result: ApiResponse<Message> = await response.json();
    return result.data;
  }

  async deleteMessage(conversationId: string, messageId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/chat/conversations/${conversationId}/messages/${messageId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete message: ${response.statusText}`);
    }
  }

  async markMessageAsRead(conversationId: string, messageId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/chat/conversations/${conversationId}/messages/${messageId}/read`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to mark message as read: ${response.statusText}`);
    }
  }

  async getOrganizationUsers(): Promise<User[]> {
    const response = await fetch(`${API_BASE_URL}/api/chat/users`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.statusText}`);
    }

    const result: ApiResponse<User[]> = await response.json();
    return result.data;
  }
}

export const chatAPI = new ChatAPI();
export default chatAPI;

