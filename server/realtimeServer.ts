import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import type { Request, Response } from 'express';
import * as commDb from './commDb.ts';

interface ClientSocket {
  ws: WebSocket;
  userEmail: string;
  userName: string;
  isAlive: boolean;
}

// Map from normalized email to Set of active client sockets
const clientsByEmail = new Map<string, Set<ClientSocket>>();

export function setupRealtimeWebSocket(wss: WebSocketServer) {
  // Heartbeat ping interval to keep connection healthy through proxies
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: WebSocket) => {
      const client = (ws as any)._clientMeta as ClientSocket | undefined;
      if (!client) return;

      if (!client.isAlive) {
        return ws.terminate();
      }
      client.isAlive = false;
      try {
        ws.ping();
      } catch (err) {
        console.error('[RealtimeWS] Ping error:', err);
      }
    });
  }, 25000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', (ws: WebSocket) => {
    let clientMeta: ClientSocket | null = null;

    ws.on('pong', () => {
      if (clientMeta) {
        clientMeta.isAlive = true;
      }
    });

    ws.on('message', (rawData) => {
      let payload: any;
      try {
        const text = rawData.toString();
        payload = JSON.parse(text);
      } catch (parseErr: any) {
        console.error('[RealtimeWS] Malformed JSON:', parseErr?.message || parseErr);
        sendToSocket(ws, {
          type: 'error',
          code: 'MALFORMED_JSON',
          error: 'Malformed JSON message payload',
        });
        return;
      }

      if (!payload || typeof payload !== 'object' || !payload.type) {
        sendToSocket(ws, {
          type: 'error',
          code: 'INVALID_SCHEMA',
          error: 'Invalid message schema: "type" is required.',
        });
        return;
      }

      try {
        switch (payload.type) {
          case 'auth:init': {
            const userEmail = (payload.userEmail || payload.userId || payload.email || '').toLowerCase().trim();
            const userName = payload.userName || payload.name || userEmail;
            if (!userEmail || !commDb.isAllowedAccount(userEmail)) {
              sendToSocket(ws, {
                type: 'auth:error',
                code: 'FORBIDDEN_UNAUTHORIZED_ACCOUNT',
                error: 'Forbidden: only registered user accounts may connect.',
              });
              ws.close(4003, 'Forbidden');
              return;
            }

            clientMeta = {
              ws,
              userEmail,
              userName,
              isAlive: true,
            };
            (ws as any)._clientMeta = clientMeta;

            if (!clientsByEmail.has(userEmail)) {
              clientsByEmail.set(userEmail, new Set());
            }
            clientsByEmail.get(userEmail)!.add(clientMeta);

            // Update DB presence
            const presence = commDb.setUserOnline(userEmail, 1);

            // Confirm auth to client
            sendToSocket(ws, {
              type: 'auth:success',
              userEmail,
              isOnline: true,
              activeSockets: presence.socketCount,
            });

            // Broadcast presence to partner / friends
            const partnerEmail = commDb.getPartnerEmail(userEmail);
            sendToUser(partnerEmail, {
              type: 'presence:update',
              userEmail,
              isOnline: true,
              lastSeen: presence.lastSeen,
            });
            break;
          }

          case 'chat:typing': {
            if (!clientMeta) {
              sendToSocket(ws, { type: 'error', code: 'UNAUTHENTICATED', error: 'Authentication required' });
              return;
            }
            const recipientEmail = (payload.recipientEmail || payload.targetEmail || payload.receiverId || '').toLowerCase().trim();
            if (!commDb.isAuthorizedDirectCommunication(clientMeta.userEmail, recipientEmail)) return;

            sendToUser(recipientEmail, {
              type: 'chat:typing',
              conversationId: commDb.DIRECT_CONVERSATION_ID,
              userEmail: clientMeta.userEmail,
              isTyping: Boolean(payload.isTyping),
            });
            break;
          }

          case 'chat:message': {
            if (!clientMeta) {
              sendToSocket(ws, { type: 'error', code: 'UNAUTHENTICATED', error: 'Authentication required' });
              return;
            }
            const { recipientEmail, targetEmail, receiverId, text, replyToId } = payload;
            const targetRecipient = (recipientEmail || targetEmail || receiverId || '').toLowerCase().trim();
            if (!targetRecipient || !text || !commDb.isAuthorizedDirectCommunication(clientMeta.userEmail, targetRecipient)) {
              sendToSocket(ws, {
                type: 'error',
                code: 'FORBIDDEN_UNAUTHORIZED_PAIR',
                error: 'Forbidden: messaging is restricted between authorized users.',
              });
              return;
            }

            // Save to database
            const savedMsg = commDb.addMessage({
              conversationId: commDb.DIRECT_CONVERSATION_ID,
              senderEmail: clientMeta.userEmail,
              recipientEmail: targetRecipient,
              text,
              replyToId,
            });

            // Acknowledge to sender
            sendToUser(clientMeta.userEmail, {
              type: 'chat:message:sent',
              message: savedMsg,
            });

            // Deliver to recipient if online
            const delivered = sendToUser(targetRecipient, {
              type: 'chat:message:new',
              message: savedMsg,
            });

            if (delivered) {
              savedMsg.status = 'delivered';
              savedMsg.deliveredAt = new Date().toISOString();
              sendToUser(clientMeta.userEmail, {
                type: 'chat:message:status',
                messageId: savedMsg.id,
                status: 'delivered',
              });
            }
            break;
          }

          case 'chat:read': {
            if (!clientMeta) {
              sendToSocket(ws, { type: 'error', code: 'UNAUTHENTICATED', error: 'Authentication required' });
              return;
            }
            const { conversationId, partnerEmail, targetEmail, receiverId } = payload;
            const targetPartner = (partnerEmail || targetEmail || receiverId || commDb.getPartnerEmail(clientMeta.userEmail)).toLowerCase().trim();
            if (!commDb.isAuthorizedDirectCommunication(clientMeta.userEmail, targetPartner)) return;

            const updatedIds = commDb.markMessagesRead(conversationId || commDb.DIRECT_CONVERSATION_ID, clientMeta.userEmail);
            if (updatedIds.length > 0) {
              sendToUser(targetPartner, {
                type: 'chat:message:read',
                conversationId: conversationId || commDb.DIRECT_CONVERSATION_ID,
                readerEmail: clientMeta.userEmail,
                messageIds: updatedIds,
              });
            }
            break;
          }

          case 'chat:delete': {
            if (!clientMeta) {
              sendToSocket(ws, { type: 'error', code: 'UNAUTHENTICATED', error: 'Authentication required' });
              return;
            }
            const { messageId, recipientEmail, targetEmail, receiverId } = payload;
            if (!messageId) return;

            const deleted = commDb.deleteMessage(messageId, clientMeta.userEmail);
            if (deleted) {
              const deleteEvt = {
                type: 'chat:message:deleted',
                messageId,
                conversationId: commDb.DIRECT_CONVERSATION_ID,
              };
              sendToUser(clientMeta.userEmail, deleteEvt);
              const target = (recipientEmail || targetEmail || receiverId || commDb.getPartnerEmail(clientMeta.userEmail)).toLowerCase().trim();
              if (commDb.isAuthorizedDirectCommunication(clientMeta.userEmail, target)) {
                sendToUser(target, deleteEvt);
              }
            }
            break;
          }

          default:
            break;
        }
      } catch (err: any) {
        console.error('[RealtimeWS] Message processing error:', err?.message || err);
        sendToSocket(ws, {
          type: 'error',
          code: 'SERVER_ERROR',
          error: err?.message || 'Internal server error',
        });
      }
    });

    ws.on('close', () => {
      if (!clientMeta) return;
      const { userEmail } = clientMeta;
      const set = clientsByEmail.get(userEmail);
      if (set) {
        set.delete(clientMeta);
        if (set.size === 0) {
          clientsByEmail.delete(userEmail);
        }
      }

      const presence = commDb.setUserOffline(userEmail, 1);
      const partnerEmail = commDb.getPartnerEmail(userEmail);
      sendToUser(partnerEmail, {
        type: 'presence:update',
        userEmail,
        isOnline: presence.isOnline,
        lastSeen: presence.lastSeen,
      });
    });
  });
}

function sendToSocket(ws: WebSocket, data: any) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(data));
    } catch {}
  }
}

function sendToUser(userEmail: string, data: any): boolean {
  const lower = userEmail.toLowerCase().trim();
  const sockets = clientsByEmail.get(lower);
  if (!sockets || sockets.size === 0) return false;

  let anyDelivered = false;
  const str = JSON.stringify(data);
  sockets.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(str);
        anyDelivered = true;
      } catch {}
    }
  });
  return anyDelivered;
}

export function createCommunicationRouter() {
  const router = express.Router();

  // Get friends / users with presence
  router.get('/users', (req: Request, res: Response) => {
    const currentEmail = (req.query.email as string) || '';
    if (!commDb.isAllowedAccount(currentEmail)) {
      res.json({ users: [] });
      return;
    }
    const users = commDb.getAllRegisteredUsers(currentEmail);
    res.json({ users });
  });

  // Get conversations for user
  router.get('/conversations', (req: Request, res: Response) => {
    const email = (req.query.email as string) || '';
    if (!email || !commDb.isAllowedAccount(email)) {
      res.json({ conversations: [] });
      return;
    }
    const conversations = commDb.getUserConversations(email);
    res.json({ conversations });
  });

  // Get or create conversation between friends
  router.post('/conversations', (req: Request, res: Response) => {
    const { userEmail, targetEmail } = req.body;
    if (!userEmail || !targetEmail) {
      res.status(400).json({ error: 'Missing userEmail or targetEmail' });
      return;
    }
    if (!commDb.isAllowedAccount(userEmail) || !commDb.isAllowedAccount(targetEmail)) {
      res.status(403).json({ error: 'Forbidden: only registered accounts are permitted' });
      return;
    }
    const result = commDb.getOrCreateDirectConversation(userEmail, targetEmail);
    const conversations = commDb.getUserConversations(userEmail);
    const current = conversations.find((c) => c.id === result.conversation.id);
    res.json({ conversation: current || result.conversation });
  });

  // Get messages for conversation
  router.get('/messages', (req: Request, res: Response) => {
    const email = (req.query.email as string) || '';
    if (!email || !commDb.isAllowedAccount(email)) {
      res.status(403).json({ error: 'Forbidden: unauthorized user' });
      return;
    }
    const messages = commDb.getMessages(commDb.DIRECT_CONVERSATION_ID, email);
    res.json({ messages });
  });

  // Send message
  router.post('/messages', (req: Request, res: Response) => {
    const { senderEmail, recipientEmail, text, replyToId } = req.body;
    if (!senderEmail || !recipientEmail || !text) {
      res.status(400).json({ error: 'Missing required message parameters' });
      return;
    }
    if (!commDb.isAllowedAccount(senderEmail) || !commDb.isAllowedAccount(recipientEmail)) {
      res.status(403).json({ error: 'Forbidden: communication is restricted between authorized accounts' });
      return;
    }
    const msg = commDb.addMessage({
      conversationId: commDb.DIRECT_CONVERSATION_ID,
      senderEmail,
      recipientEmail,
      text,
      replyToId,
    });
    // Broadcast to recipient and sender in real-time
    sendToUser(recipientEmail, {
      type: 'chat:message:new',
      message: msg,
    });
    sendToUser(senderEmail, {
      type: 'chat:message:sent',
      message: msg,
    });
    res.json({ message: msg });
  });

  // Delete message
  router.delete('/messages/:id', (req: Request, res: Response) => {
    const messageId = req.params.id;
    const userEmail = (req.query.email as string) || (req.body.email as string) || '';
    if (!userEmail || !commDb.isAllowedAccount(userEmail)) {
      res.status(403).json({ error: 'Forbidden: unauthorized account' });
      return;
    }
    const ok = commDb.deleteMessage(messageId, userEmail);
    if (!ok) {
      res.status(403).json({ error: 'Unauthorized or message not found' });
      return;
    }
    res.json({ success: true, messageId });
  });

  // Mark messages read
  router.post('/messages/read', (req: Request, res: Response) => {
    const { readerEmail } = req.body;
    if (!readerEmail || !commDb.isAllowedAccount(readerEmail)) {
      res.status(403).json({ error: 'Forbidden: unauthorized account' });
      return;
    }
    const updatedIds = commDb.markMessagesRead(commDb.DIRECT_CONVERSATION_ID, readerEmail);
    res.json({ success: true, updatedIds });
  });

  return router;
}
