export interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  isActive?: boolean;
  role?: string;
  isOnline?: boolean;
}

export interface Conversation {
  _id: string;
  type: 'direct' | 'group';
  participants: User[];
  name?: string;
  description?: string;
  avatar?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: {
    content: string;
    senderId: string;
    timestamp: Date;
    type: string;
    sender?: User;
  };
  isActive: boolean;
  unreadCount?: number;
  departmentId?: string;
}

export interface Message {
  _id: string;
  conversationId: string;
  organizationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'file' | 'image' | 'system';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  timestamp: Date;
  editedAt?: Date;
  isEdited: boolean;
  readBy: Array<{
    userId: string;
    readAt: Date;
  }>;
  replyTo?: string;
  sender?: User;
}

export interface TypingUser {
  userId: string;
  userName: string;
  conversationId: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  timestamp: string;
}

export interface SendMessageRequest {
  content: string;
  type?: 'text' | 'file' | 'image';
  replyTo?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page?: number;
    limit: number;
    skip?: number;
    total?: number;
    pages?: number;
    hasMore?: boolean;
  };
  message?: string;
  timestamp: string;
}

export interface UseMessagesReturn {
  messages: Message[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  sendMessage: (content: string, type?: string, replyTo?: string) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  markAsRead: (messageId: string) => Promise<void>;
}

export interface ChatAreaProps {
  conversationId?: string;
  currentUser?: string;
}

export interface MessageListProps {
  conversationId: string;
  currentUser: string;
}

export interface MessageInputProps {
  conversationId: string;
  currentUser: string;
}

