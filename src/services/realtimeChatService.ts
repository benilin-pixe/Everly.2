import {
  CommunicationUser,
  Conversation,
  ChatMessage,
} from '../types/communication';

export type MessageListener = (message: ChatMessage) => void;
export type MessageStatusListener = (data: { messageId: string; status: 'delivered' | 'read' }) => void;
export type MessageDeleteListener = (data: { messageId: string; conversationId: string }) => void;
export type TypingListener = (data: { conversationId: string; userEmail: string; isTyping: boolean }) => void;
export type PresenceListener = (data: { userEmail: string; isOnline: boolean; lastSeen: string }) => void;

class RealtimeChatService {
  private mounted = false;
  private ws: WebSocket | null = null;
  private currentUserEmail: string | null = null;
  private currentUserName: string | null = null;
  private isConnecting = false;
  private shouldReconnect = true;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private restPollingInterval: any = null;
  private isRestFallback = false;
  private reconnectTimeout: any = null;
  private typingTimeout: any = null;
  private pendingMountConnect: (() => void) | null = null;

  // Listeners
  private messageListeners = new Set<MessageListener>();
  private messageStatusListeners = new Set<MessageStatusListener>();
  private messageDeleteListeners = new Set<MessageDeleteListener>();
  private typingListeners = new Set<TypingListener>();
  private presenceListeners = new Set<PresenceListener>();
  private connectionChangeListeners = new Set<(connected: boolean) => void>();

  public setMounted(mounted = true) {
    this.mounted = mounted;
    if (this.mounted && this.currentUserEmail && this.shouldReconnect && !this.ws && !this.isConnecting) {
      this.initSocket();
    }
  }

  public isMounted(): boolean {
    return this.mounted;
  }

  public static markAppMounted() {
    realtimeChatService.setMounted(true);
  }

  public connect(userEmail: string, userName: string) {
    const normalizedEmail = userEmail.toLowerCase().trim();
    if (this.ws && this.currentUserEmail === normalizedEmail && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.currentUserEmail = normalizedEmail;
    this.currentUserName = userName;
    this.shouldReconnect = true;

    if (!this.mounted) {
      if (typeof document !== 'undefined' && document.readyState === 'complete') {
        this.mounted = true;
      } else {
        if (this.pendingMountConnect && typeof window !== 'undefined') {
          window.removeEventListener('load', this.pendingMountConnect);
          window.removeEventListener('DOMContentLoaded', this.pendingMountConnect);
        }

        this.pendingMountConnect = () => {
          this.mounted = true;
          this.pendingMountConnect = null;
          if (this.currentUserEmail && this.shouldReconnect && !this.ws) {
            this.initSocket();
          }
        };

        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
          if (document.readyState === 'loading') {
            window.addEventListener('DOMContentLoaded', this.pendingMountConnect, { once: true });
            window.addEventListener('load', this.pendingMountConnect, { once: true });
          } else {
            setTimeout(this.pendingMountConnect, 50);
          }
        }
        return;
      }
    }

    this.initSocket();
  }

  public disconnect() {
    this.shouldReconnect = false;
    this.stopRestPolling();
    if (this.pendingMountConnect) {
      if (typeof window !== 'undefined') {
        window.removeEventListener('load', this.pendingMountConnect);
        window.removeEventListener('DOMContentLoaded', this.pendingMountConnect);
      }
      this.pendingMountConnect = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      try {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.close();
      } catch {}
    }
    this.isConnecting = false;
    this.notifyConnectionState(false);
  }

  private initSocket() {
    if (!this.currentUserEmail || this.isConnecting) return;
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;

    if (!this.mounted) {
      return;
    }

    this.isConnecting = true;

    try {
      const isHttps = window.location.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/api/ws`;

      let socket: WebSocket;
      try {
        socket = new WebSocket(wsUrl);
      } catch (instantiationError) {
        console.warn('[RealtimeChat] WebSocket constructor failed:', instantiationError);
        this.isConnecting = false;
        this.notifyConnectionState(false);
        this.scheduleReconnect();
        return;
      }

      this.ws = socket;

      socket.onopen = () => {
        if (this.ws !== socket) return;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.stopRestPolling();
        this.notifyConnectionState(true);

        try {
          this.send({
            type: 'auth:init',
            userEmail: this.currentUserEmail,
            userName: this.currentUserName,
          });
        } catch (sendErr) {
          console.warn('[RealtimeChat] Failed to send auth init:', sendErr);
        }
      };

      socket.onerror = (event: Event) => {
        if (this.ws !== socket) return;
        this.isConnecting = false;
        this.notifyConnectionState(false);
        if (event && typeof (event as any).preventDefault === 'function') {
          (event as any).preventDefault();
        }
      };

      socket.onclose = () => {
        if (this.ws !== socket) return;
        this.isConnecting = false;
        this.notifyConnectionState(false);
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };

      socket.onmessage = (event: MessageEvent) => {
        if (this.ws !== socket) return;
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingMessage(data);
        } catch (err) {
          console.warn('[RealtimeChat] JSON parse error:', err);
        }
      };
    } catch (err) {
      this.isConnecting = false;
      this.notifyConnectionState(false);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect) return;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.info('[RealtimeChat] Reconnect limit reached; switching to bounded REST polling fallback mode.');
      this.startRestPolling();
      return;
    }

    const baseDelay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);
    const jitter = Math.floor(Math.random() * 800);
    const delay = baseDelay + jitter;
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.initSocket();
    }, delay);
  }

  public manualReconnect() {
    this.stopRestPolling();
    this.reconnectAttempts = 0;
    this.shouldReconnect = true;
    this.initSocket();
  }

  private startRestPolling() {
    if (this.restPollingInterval) return;
    this.isRestFallback = true;
    this.restPollingInterval = setInterval(async () => {
      if (!this.currentUserEmail) return;
      try {
        const messages = await this.fetchMessages(this.currentUserEmail);
        if (messages.length > 0) {
          const latest = messages[messages.length - 1];
          this.messageListeners.forEach((l) => l(latest));
        }
      } catch {}
    }, 12000);
  }

  private stopRestPolling() {
    if (this.restPollingInterval) {
      clearInterval(this.restPollingInterval);
      this.restPollingInterval = null;
    }
    this.isRestFallback = false;
  }

  private send(data: any): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  private handleIncomingMessage(payload: any) {
    switch (payload.type) {
      case 'chat:message:new':
      case 'chat:message:sent': {
        if (payload.message) {
          this.messageListeners.forEach((l) => l(payload.message));
        }
        break;
      }

      case 'chat:message:status': {
        this.messageStatusListeners.forEach((l) =>
          l({ messageId: payload.messageId, status: payload.status })
        );
        break;
      }

      case 'chat:message:read': {
        if (Array.isArray(payload.messageIds)) {
          payload.messageIds.forEach((id: string) => {
            this.messageStatusListeners.forEach((l) => l({ messageId: id, status: 'read' }));
          });
        }
        break;
      }

      case 'chat:message:deleted': {
        this.messageDeleteListeners.forEach((l) =>
          l({ messageId: payload.messageId, conversationId: payload.conversationId })
        );
        break;
      }

      case 'chat:typing': {
        this.typingListeners.forEach((l) =>
          l({
            conversationId: payload.conversationId,
            userEmail: payload.userEmail,
            isTyping: payload.isTyping,
          })
        );
        break;
      }

      case 'presence:update': {
        this.presenceListeners.forEach((l) =>
          l({
            userEmail: payload.userEmail,
            isOnline: payload.isOnline,
            lastSeen: payload.lastSeen,
          })
        );
        break;
      }

      default:
        break;
    }
  }

  // Client Actions
  public async sendChatMessage(
    conversationId: string,
    recipientEmail: string,
    text: string,
    replyToId?: string
  ): Promise<void> {
    const sent = this.send({
      type: 'chat:message',
      conversationId,
      recipientEmail,
      text,
      replyToId,
    });

    if (!sent) {
      await this.sendMessageViaApi({
        senderEmail: this.currentUserEmail || '',
        recipientEmail,
        text,
        replyToId,
      });
    }
  }

  public setTyping(conversationId: string, recipientEmail: string, isTyping: boolean) {
    this.send({
      type: 'chat:typing',
      conversationId,
      recipientEmail,
      isTyping,
    });
  }

  public markAsRead(conversationId: string, partnerEmail: string) {
    this.send({
      type: 'chat:read',
      conversationId,
      partnerEmail,
    });
  }

  public deleteChatMessage(messageId: string, conversationId: string, recipientEmail: string) {
    this.send({
      type: 'chat:delete',
      messageId,
      conversationId,
      recipientEmail,
    });
  }

  // Subscriptions
  public subscribeMessages(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public subscribeMessageStatus(listener: MessageStatusListener): () => void {
    this.messageStatusListeners.add(listener);
    return () => this.messageStatusListeners.delete(listener);
  }

  public subscribeMessageDelete(listener: MessageDeleteListener): () => void {
    this.messageDeleteListeners.add(listener);
    return () => this.messageDeleteListeners.delete(listener);
  }

  public subscribeTyping(listener: TypingListener): () => void {
    this.typingListeners.add(listener);
    return () => this.typingListeners.delete(listener);
  }

  public subscribePresence(listener: PresenceListener): () => void {
    this.presenceListeners.add(listener);
    return () => this.presenceListeners.delete(listener);
  }

  public subscribeConnection(listener: (connected: boolean) => void): () => void {
    this.connectionChangeListeners.add(listener);
    listener(this.isConnected());
    return () => this.connectionChangeListeners.delete(listener);
  }

  private notifyConnectionState(connected: boolean) {
    this.connectionChangeListeners.forEach((l) => l(connected));
  }

  public isConnected(): boolean {
    return Boolean(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  // REST API Fallbacks
  public async fetchConversations(email: string): Promise<Conversation[]> {
    try {
      const res = await fetch(`/api/comm/conversations?email=${encodeURIComponent(email)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.conversations || [];
    } catch {
      return [];
    }
  }

  public async fetchMessages(email: string): Promise<ChatMessage[]> {
    try {
      const res = await fetch(`/api/comm/messages?email=${encodeURIComponent(email)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.messages || [];
    } catch {
      return [];
    }
  }

  public async fetchRegisteredUsers(email: string): Promise<CommunicationUser[]> {
    try {
      const res = await fetch(`/api/comm/users?email=${encodeURIComponent(email)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.users || [];
    } catch {
      return [];
    }
  }

  public async sendMessageViaApi(data: {
    senderEmail: string;
    recipientEmail: string;
    text: string;
    replyToId?: string;
  }): Promise<ChatMessage | null> {
    try {
      const res = await fetch('/api/comm/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.message || null;
    } catch {
      return null;
    }
  }

  public async deleteMessageViaApi(messageId: string, email: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/comm/messages/${messageId}?email=${encodeURIComponent(email)}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const realtimeChatService = new RealtimeChatService();
export const markAppMounted = RealtimeChatService.markAppMounted;
