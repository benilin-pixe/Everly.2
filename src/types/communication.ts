import { UserRole } from '../types';

export interface CommunicationUser {
  email: string;
  name: string;
  role: UserRole;
  bio?: string;
  avatarInitials: string;
  avatarColor: string;
  isOnline: boolean;
  lastSeen: string;
}

export interface ConversationMember {
  id: string;
  conversationId: string;
  userEmail: string;
  joinedAt: string;
  lastReadMessageId?: string;
  lastReadAt?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderEmail: string;
  recipientEmail: string;
  text: string;
  replyToId?: string;
  replyToMessage?: {
    id: string;
    senderEmail: string;
    text: string;
  };
  createdAt: string;
  status: 'sent' | 'delivered' | 'read';
  deliveredAt?: string;
  readAt?: string;
  deleted: boolean;
}

export interface MessageRead {
  id: string;
  messageId: string;
  userEmail: string;
  readAt: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  createdAt: string;
  updatedAt: string;
  lastMessage?: ChatMessage;
  unreadCount?: number;
  partner?: CommunicationUser;
}

export interface UserPresence {
  userEmail: string;
  isOnline: boolean;
  lastSeen: string;
  socketCount: number;
}
