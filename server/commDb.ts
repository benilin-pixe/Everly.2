import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ORIGINAL_DATA_DIR = path.resolve(__dirname, '../data');
const DATA_DIR = process.env.VERCEL
  ? path.resolve('/tmp', 'everly_data')
  : ORIGINAL_DATA_DIR;
const DB_FILE = path.join(DATA_DIR, 'communications.json');

// Two-Account System Configuration (Friends / Social Network)
export const ACCOUNT_1_EMAIL = 'benilin76@gmail.com';
export const ACCOUNT_2_EMAIL = 'shanalove917@gmail.com';
export const ALLOWED_EMAILS = new Set([ACCOUNT_1_EMAIL, ACCOUNT_2_EMAIL]);
export const DIRECT_CONVERSATION_ID = 'conv_friends_direct';

export function isAllowedAccount(email?: string): boolean {
  if (!email) return false;
  return ALLOWED_EMAILS.has(email.toLowerCase().trim());
}

export function isAuthorizedDirectCommunication(userA?: string, userB?: string): boolean {
  if (!userA || !userB) return false;
  const a = userA.toLowerCase().trim();
  const b = userB.toLowerCase().trim();
  const isAtoB = a === ACCOUNT_1_EMAIL && b === ACCOUNT_2_EMAIL;
  const isBtoA = a === ACCOUNT_2_EMAIL && b === ACCOUNT_1_EMAIL;
  return isAtoB || isBtoA;
}

export function getPartnerEmail(email: string): string {
  const lower = email.toLowerCase().trim();
  return lower === ACCOUNT_1_EMAIL ? ACCOUNT_2_EMAIL : ACCOUNT_1_EMAIL;
}

export interface DbUserPresence {
  userEmail: string;
  isOnline: boolean;
  lastSeen: string;
  socketCount: number;
}

export interface DbConversation {
  id: string;
  type: 'direct';
  createdAt: string;
  updatedAt: string;
}

export interface DbConversationMember {
  id: string;
  conversationId: string;
  userEmail: string;
  joinedAt: string;
  lastReadMessageId?: string;
  lastReadAt?: string;
}

export interface DbMessage {
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

export interface DbMessageRead {
  id: string;
  messageId: string;
  userEmail: string;
  readAt: string;
}

export interface CommDatabase {
  conversations: DbConversation[];
  conversation_members: DbConversationMember[];
  messages: DbMessage[];
  message_reads: DbMessageRead[];
  user_presence: DbUserPresence[];
}

export const REGISTERED_USERS_META: Record<
  string,
  { name: string; avatarInitials: string; avatarColor: string; role: string; bio: string }
> = {
  [ACCOUNT_1_EMAIL]: {
    name: 'Ben Lin',
    avatarInitials: 'BL',
    avatarColor: 'from-blue-500 to-indigo-600',
    role: 'Member',
    bio: 'Coding & creative projects 🚀',
  },
  [ACCOUNT_2_EMAIL]: {
    name: 'Shana Love',
    avatarInitials: 'SL',
    avatarColor: 'from-emerald-500 to-teal-600',
    role: 'Member',
    bio: 'Music, visual arts & coffee ☕',
  },
};

let dbCache: CommDatabase | null = null;

function sanitizeAndMigrateDb(db: any): CommDatabase {
  const now = new Date().toISOString();
  const past5m = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  // Filter messages to only those strictly between the two allowed accounts
  const validMessages: DbMessage[] = (db.messages || []).filter(
    (m: any) =>
      !m.id?.startsWith('msg_seed_') &&
      isAllowedAccount(m.senderEmail) &&
      isAllowedAccount(m.recipientEmail) &&
      m.senderEmail.toLowerCase() !== m.recipientEmail.toLowerCase()
  );

  const presence1 = db.user_presence?.find((p: any) => p.userEmail.toLowerCase() === ACCOUNT_1_EMAIL) || {
    userEmail: ACCOUNT_1_EMAIL,
    isOnline: true,
    lastSeen: now,
    socketCount: 1,
  };
  const presence2 = db.user_presence?.find((p: any) => p.userEmail.toLowerCase() === ACCOUNT_2_EMAIL) || {
    userEmail: ACCOUNT_2_EMAIL,
    isOnline: true,
    lastSeen: now,
    socketCount: 0,
  };

  const cleanDb: CommDatabase = {
    conversations: [
      {
        id: DIRECT_CONVERSATION_ID,
        type: 'direct',
        createdAt: past5m,
        updatedAt: now,
      },
    ],
    conversation_members: [
      {
        id: 'member_ben',
        conversationId: DIRECT_CONVERSATION_ID,
        userEmail: ACCOUNT_1_EMAIL,
        joinedAt: past5m,
      },
      {
        id: 'member_shana',
        conversationId: DIRECT_CONVERSATION_ID,
        userEmail: ACCOUNT_2_EMAIL,
        joinedAt: past5m,
      },
    ],
    messages: validMessages.map((m) => ({ ...m, conversationId: DIRECT_CONVERSATION_ID })),
    message_reads: (db.message_reads || []).filter((r: any) => isAllowedAccount(r.userEmail)),
    user_presence: [presence1, presence2],
  };

  return cleanDb;
}

function loadDatabase(): CommDatabase {
  if (dbCache) return dbCache;

  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch {}
  }
  if (process.env.VERCEL && !fs.existsSync(DB_FILE)) {
    const origFile = path.join(ORIGINAL_DATA_DIR, 'communications.json');
    if (fs.existsSync(origFile)) {
      try {
        fs.copyFileSync(origFile, DB_FILE);
      } catch {}
    }
  }

  let rawDb: any = {
    conversations: [],
    conversation_members: [],
    messages: [],
    message_reads: [],
    user_presence: [],
  };

  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      rawDb = JSON.parse(content);
    } catch (e) {
      console.error('[commDb] Error loading database file, reinitializing:', e);
    }
  }

  dbCache = sanitizeAndMigrateDb(rawDb);
  saveDatabase();
  return dbCache;
}

function saveDatabase() {
  if (!dbCache) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[commDb] Error saving database:', err);
  }
}

// User Presence Operations
export function getUserPresence(email: string): DbUserPresence {
  if (!isAllowedAccount(email)) {
    return {
      userEmail: email.toLowerCase().trim(),
      isOnline: false,
      lastSeen: new Date(0).toISOString(),
      socketCount: 0,
    };
  }
  const db = loadDatabase();
  const lower = email.toLowerCase().trim();
  let presence = db.user_presence.find((p) => p.userEmail.toLowerCase() === lower);
  if (!presence) {
    presence = {
      userEmail: lower,
      isOnline: false,
      lastSeen: new Date().toISOString(),
      socketCount: 0,
    };
    db.user_presence.push(presence);
    saveDatabase();
  }
  return presence;
}

export function setUserOnline(email: string, socketIncrement = 1): DbUserPresence {
  if (!isAllowedAccount(email)) {
    throw new Error('Access denied: user account not allowed in chat platform');
  }
  const db = loadDatabase();
  const lower = email.toLowerCase().trim();
  let presence = db.user_presence.find((p) => p.userEmail.toLowerCase() === lower);
  if (!presence) {
    presence = {
      userEmail: lower,
      isOnline: true,
      lastSeen: new Date().toISOString(),
      socketCount: socketIncrement,
    };
    db.user_presence.push(presence);
  } else {
    presence.socketCount = Math.max(0, presence.socketCount + socketIncrement);
    presence.isOnline = presence.socketCount > 0;
    presence.lastSeen = new Date().toISOString();
  }
  saveDatabase();
  return presence;
}

export function setUserOffline(email: string, socketDecrement = 1): DbUserPresence {
  if (!isAllowedAccount(email)) return getUserPresence(email);
  const db = loadDatabase();
  const lower = email.toLowerCase().trim();
  const presence = db.user_presence.find((p) => p.userEmail.toLowerCase() === lower);
  if (presence) {
    presence.socketCount = Math.max(0, presence.socketCount - socketDecrement);
    presence.isOnline = presence.socketCount > 0;
    presence.lastSeen = new Date().toISOString();
    saveDatabase();
    return presence;
  }
  return getUserPresence(email);
}

// User Discovery
export function getAllRegisteredUsers(currentEmail?: string) {
  if (!currentEmail || !isAllowedAccount(currentEmail)) {
    return [];
  }

  const partnerEmail = getPartnerEmail(currentEmail);
  const meta = REGISTERED_USERS_META[partnerEmail];
  const presence = getUserPresence(partnerEmail);

  return [
    {
      email: partnerEmail,
      name: meta.name,
      role: meta.role,
      bio: meta.bio,
      avatarInitials: meta.avatarInitials,
      avatarColor: meta.avatarColor,
      isOnline: presence.isOnline,
      lastSeen: presence.lastSeen,
    },
  ];
}

// Direct Conversation Operations
export function getOrCreateDirectConversation(userA: string, userB: string): { conversation: DbConversation; members: DbConversationMember[] } {
  if (!isAllowedAccount(userA) || !isAllowedAccount(userB) || userA.toLowerCase().trim() === userB.toLowerCase().trim()) {
    throw new Error('Access denied: communication is restricted between authorized accounts');
  }

  const db = loadDatabase();
  const conv = db.conversations.find((c) => c.id === DIRECT_CONVERSATION_ID) || {
    id: DIRECT_CONVERSATION_ID,
    type: 'direct' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const members = db.conversation_members.filter((m) => m.conversationId === DIRECT_CONVERSATION_ID);

  return { conversation: conv, members };
}

export function getUserConversations(userEmail: string) {
  if (!isAllowedAccount(userEmail)) {
    return [];
  }

  const db = loadDatabase();
  const lower = userEmail.toLowerCase().trim();
  const partnerEmail = getPartnerEmail(lower);
  const meta = REGISTERED_USERS_META[partnerEmail];
  const presence = getUserPresence(partnerEmail);

  const partner = {
    email: partnerEmail,
    name: meta.name,
    role: meta.role,
    bio: meta.bio,
    avatarInitials: meta.avatarInitials,
    avatarColor: meta.avatarColor,
    isOnline: presence.isOnline,
    lastSeen: presence.lastSeen,
  };

  const msgs = db.messages.filter((m) => m.conversationId === DIRECT_CONVERSATION_ID && !m.deleted);
  msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : undefined;

  const unreadCount = msgs.filter((m) => m.senderEmail.toLowerCase() !== lower && m.status !== 'read').length;

  const conv = db.conversations[0] || {
    id: DIRECT_CONVERSATION_ID,
    type: 'direct' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return [
    {
      ...conv,
      lastMessage: lastMsg,
      unreadCount,
      partner,
    },
  ];
}

// Message Operations
export function getMessages(conversationId: string, userEmail: string): DbMessage[] {
  if (!isAllowedAccount(userEmail)) {
    return [];
  }

  const db = loadDatabase();
  const msgs = db.messages.filter((m) => !m.deleted);
  msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return msgs;
}

export function addMessage(data: {
  conversationId: string;
  senderEmail: string;
  recipientEmail: string;
  text: string;
  replyToId?: string;
}): DbMessage {
  const sender = data.senderEmail.toLowerCase().trim();
  const recipient = data.recipientEmail.toLowerCase().trim();

  // Strict backend security validation
  if (!isAllowedAccount(sender) || !isAllowedAccount(recipient) || sender === recipient) {
    throw new Error('Forbidden: messaging is strictly restricted between authorized accounts');
  }

  const db = loadDatabase();
  const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  let replyToMessage: { id: string; senderEmail: string; text: string } | undefined = undefined;
  if (data.replyToId) {
    const parent = db.messages.find((m) => m.id === data.replyToId);
    if (parent) {
      replyToMessage = {
        id: parent.id,
        senderEmail: parent.senderEmail,
        text: parent.text.slice(0, 100),
      };
    }
  }

  const recipientPresence = getUserPresence(recipient);
  const initialStatus: 'sent' | 'delivered' = recipientPresence.isOnline ? 'delivered' : 'sent';

  const newMsg: DbMessage = {
    id,
    conversationId: DIRECT_CONVERSATION_ID,
    senderEmail: sender,
    recipientEmail: recipient,
    text: data.text.trim(),
    replyToId: data.replyToId,
    replyToMessage,
    createdAt: now,
    status: initialStatus,
    deliveredAt: recipientPresence.isOnline ? now : undefined,
    deleted: false,
  };

  db.messages.push(newMsg);

  if (db.conversations[0]) {
    db.conversations[0].updatedAt = now;
  }

  saveDatabase();
  return newMsg;
}

export function deleteMessage(messageId: string, userEmail: string): boolean {
  if (!isAllowedAccount(userEmail)) return false;

  const db = loadDatabase();
  const lower = userEmail.toLowerCase().trim();
  const msg = db.messages.find((m) => m.id === messageId);
  if (!msg) return false;

  // Security: only sender can delete
  if (msg.senderEmail.toLowerCase() !== lower) {
    return false;
  }

  msg.deleted = true;
  saveDatabase();
  return true;
}

export function markMessagesRead(conversationId: string, readerEmail: string): string[] {
  if (!isAllowedAccount(readerEmail)) return [];

  const db = loadDatabase();
  const lower = readerEmail.toLowerCase().trim();
  const now = new Date().toISOString();
  const updatedIds: string[] = [];

  for (const m of db.messages) {
    if (m.recipientEmail.toLowerCase() === lower && m.status !== 'read' && !m.deleted) {
      m.status = 'read';
      m.readAt = now;
      updatedIds.push(m.id);

      db.message_reads.push({
        id: `read_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        messageId: m.id,
        userEmail: lower,
        readAt: now,
      });
    }
  }

  if (updatedIds.length > 0) {
    saveDatabase();
  }
  return updatedIds;
}
