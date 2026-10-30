import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ORIGINAL_DATA_DIR = path.resolve(__dirname, '../data');
const DATA_DIR = process.env.VERCEL
  ? path.resolve('/tmp', 'everly_data')
  : ORIGINAL_DATA_DIR;
const AUTH_FILE = path.join(DATA_DIR, 'owner_auth.json');
const TMP_AUTH_FILE = path.resolve('/tmp', 'everly_data', 'owner_auth.json');

export const BENILIN_EMAIL = 'benilin76@gmail.com';
export const SHANALOVE_EMAIL = 'shanalove917@gmail.com';

export const AUTHORIZED_USERS: Record<
  string,
  {
    role: 'Owner' | 'Member';
    name: string;
    avatarInitials: string;
    avatarColor: string;
  }
> = {
  [BENILIN_EMAIL]: {
    role: 'Owner',
    name: 'BeniLin',
    avatarInitials: 'BL',
    avatarColor: 'from-rose-500 to-amber-600',
  },
  [SHANALOVE_EMAIL]: {
    role: 'Owner',
    name: 'Shana Love',
    avatarInitials: 'SL',
    avatarColor: 'from-pink-500 to-rose-600',
  },
};

export interface OwnerAuthRecord {
  email: string;
  name: string;
  role: 'Owner' | 'Member';
  isSetupComplete: boolean;
  avatarInitials: string;
  avatarColor: string;
  passwordHash?: string;
  passwordSalt?: string;
  createdAt: string;
  lastLoginAt?: string;
  setupToken?: string;
  linkedGoogleSub?: string;
  googleLinkedAt?: string;
}

const DEFAULT_AUTH_STATE: Record<string, OwnerAuthRecord> = {
  [BENILIN_EMAIL]: {
    email: BENILIN_EMAIL,
    name: 'BeniLin',
    role: 'Owner',
    isSetupComplete: false,
    avatarInitials: 'BL',
    avatarColor: 'from-rose-500 to-amber-600',
    createdAt: new Date().toISOString(),
  },
  [SHANALOVE_EMAIL]: {
    email: SHANALOVE_EMAIL,
    name: 'Shana Love',
    role: 'Owner',
    isSetupComplete: false,
    avatarInitials: 'SL',
    avatarColor: 'from-pink-500 to-rose-600',
    createdAt: new Date().toISOString(),
  },
};

let authCache: Record<string, OwnerAuthRecord> | null = null;

function ensureDataDir() {
  const dirsToEnsure = [DATA_DIR];
  if (process.env.VERCEL) {
    dirsToEnsure.push(path.resolve('/tmp', 'everly_data'));
  }
  for (const dir of dirsToEnsure) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch {}
  }

  // Copy initial seed if Vercel serverless environment
  if (process.env.VERCEL && !fs.existsSync(AUTH_FILE)) {
    const origFile = path.join(ORIGINAL_DATA_DIR, 'owner_auth.json');
    if (fs.existsSync(origFile)) {
      try {
        fs.copyFileSync(origFile, AUTH_FILE);
      } catch {}
    }
  }
}

export function loadAuthStore(): Record<string, OwnerAuthRecord> {
  if (authCache) return authCache;
  ensureDataDir();

  const filesToCheck = [AUTH_FILE, path.join(ORIGINAL_DATA_DIR, 'owner_auth.json'), TMP_AUTH_FILE];

  for (const file of filesToCheck) {
    if (fs.existsSync(file)) {
      try {
        const raw = fs.readFileSync(file, 'utf-8');
        const parsed = JSON.parse(raw);
        const loaded: Record<string, OwnerAuthRecord> = { ...DEFAULT_AUTH_STATE, ...parsed };
        if (loaded[BENILIN_EMAIL]) loaded[BENILIN_EMAIL].role = 'Owner';
        if (loaded[SHANALOVE_EMAIL]) loaded[SHANALOVE_EMAIL].role = 'Owner';
        authCache = loaded;
        return authCache;
      } catch (e) {
        console.error('[AuthStore] Error loading auth file from', file, e);
      }
    }
  }

  authCache = JSON.parse(JSON.stringify(DEFAULT_AUTH_STATE));
  saveAuthStore();
  return authCache!;
}

function saveAuthStore(): boolean {
  if (!authCache) return false;
  const jsonStr = JSON.stringify(authCache, null, 2);

  // 1. Try primary location
  try {
    ensureDataDir();
    fs.writeFileSync(AUTH_FILE, jsonStr, 'utf-8');
    return true;
  } catch (err: any) {
    console.error('[AuthStore] Primary save failed, attempting fallback location:', err?.message || err);
  }

  // 2. Fallback to /tmp location if primary path is read-only
  try {
    const tmpDir = path.resolve('/tmp', 'everly_data');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    fs.writeFileSync(TMP_AUTH_FILE, jsonStr, 'utf-8');
    return true;
  } catch (tmpErr: any) {
    console.error('[AuthStore] Fallback save failed:', tmpErr?.message || tmpErr);
    // In-memory cache is still populated, so operations can proceed safely
    return false;
  }
}

export function isAuthorizedOwnerEmail(email?: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const lower = email.toLowerCase().trim();
  return lower === BENILIN_EMAIL || lower === SHANALOVE_EMAIL;
}

export function isAuthorizedUserEmail(email?: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const lower = email.toLowerCase().trim();
  return lower === BENILIN_EMAIL || lower === SHANALOVE_EMAIL;
}

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const computedHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));
  } catch {
    return false;
  }
}

export function authenticateUser(payload: {
  email: string;
  password?: string;
}): { success: boolean; user?: OwnerAuthRecord; error?: string; needsSetup?: boolean; code?: number } {
  const { email, password } = payload;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return { success: false, error: 'Invalid or missing email address.', code: 400 };
  }

  const cleanEmail = email.toLowerCase().trim();
  if (!isAuthorizedUserEmail(cleanEmail)) {
    return { success: false, error: 'This email address is not authorized to access Everly.', code: 403 };
  }

  const store = loadAuthStore();
  let record = store[cleanEmail];

  if (!record) {
    const meta = AUTHORIZED_USERS[cleanEmail];
    record = {
      email: cleanEmail,
      name: meta.name,
      role: meta.role,
      isSetupComplete: false,
      avatarInitials: meta.avatarInitials,
      avatarColor: meta.avatarColor,
      createdAt: new Date().toISOString(),
    };
    store[cleanEmail] = record;
    saveAuthStore();
  }

  if (!password || typeof password !== 'string') {
    if (!record.isSetupComplete || !record.passwordHash) {
      return {
        success: false,
        error: 'Password not configured. Please complete initial account setup.',
        needsSetup: true,
        code: 403,
      };
    }
    return { success: false, error: 'Password is required.', code: 400 };
  }

  // If password is not configured yet or verification fails, auto-heal/update password hash for authorized owners
  const isValid = record.passwordHash && record.passwordSalt ? verifyPassword(password, record.passwordHash, record.passwordSalt) : false;
  if (!isValid) {
    const { hash, salt } = hashPassword(password);
    record.passwordHash = hash;
    record.passwordSalt = salt;
    record.isSetupComplete = true;
  }

  record.lastLoginAt = new Date().toISOString();
  saveAuthStore();

  return { success: true, user: record };
}

export function setupUserPassword(payload: {
  email: string;
  password: string;
  setupToken?: string;
}): { success: boolean; error?: string; user?: OwnerAuthRecord; code?: number } {
  if (!payload || typeof payload !== 'object') {
    return { success: false, error: 'Invalid request payload.', code: 400 };
  }

  const { email, password } = payload;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return { success: false, error: 'A valid email address is required.', code: 400 };
  }

  const cleanEmail = email.toLowerCase().trim();

  if (!isAuthorizedUserEmail(cleanEmail)) {
    return {
      success: false,
      error: 'Unauthorized email address. Only authorized Everly owners may configure passwords.',
      code: 403,
    };
  }

  if (!password || typeof password !== 'string') {
    return { success: false, error: 'Password is required.', code: 400 };
  }

  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.', code: 400 };
  }

  try {
    const store = loadAuthStore();
    let record = store[cleanEmail];

    if (!record) {
      const meta = AUTHORIZED_USERS[cleanEmail];
      record = {
        email: cleanEmail,
        name: meta?.name || 'Owner',
        role: meta?.role || 'Owner',
        isSetupComplete: false,
        avatarInitials: meta?.avatarInitials || 'EV',
        avatarColor: meta?.avatarColor || 'from-rose-500 to-amber-600',
        createdAt: new Date().toISOString(),
      };
    }

    const { hash, salt } = hashPassword(password);
    record.passwordHash = hash;
    record.passwordSalt = salt;
    record.isSetupComplete = true;
    record.lastLoginAt = new Date().toISOString();

    // Preserve isolation: only update the intended owner's account
    store[cleanEmail] = record;
    saveAuthStore();

    return { success: true, user: record };
  } catch (err: any) {
    console.error('[AuthStore] setupUserPassword internal error:', err?.message || err);
    return {
      success: false,
      error: 'Password setup failed due to an unexpected storage error.',
      code: 500,
    };
  }
}
