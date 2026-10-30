import { AuthorizedUser, UserRole } from '../types';

export const PRIMARY_OWNER_EMAIL = 'benilin76@gmail.com';
export const SHARED_USER_EMAIL = 'shanalove917@gmail.com';

export const AUTHORIZED_USERS: Record<string, { name: string; role: UserRole; avatarInitials: string; avatarColor: string }> = {
  [PRIMARY_OWNER_EMAIL]: {
    name: 'BeniLin',
    role: 'Owner',
    avatarInitials: 'BL',
    avatarColor: 'from-rose-500 to-amber-600',
  },
  [SHARED_USER_EMAIL]: {
    name: 'Shana Love',
    role: 'Owner',
    avatarInitials: 'SL',
    avatarColor: 'from-pink-500 to-rose-600',
  },
};

const AUTH_STORAGE_KEY = 'everly_password_user_v6';
const TOKEN_STORAGE_KEY = 'everly_password_token_v6';
const ACCESS_DENIED_STORAGE_KEY = 'everly_denied_attempt_v6';

/**
 * Authenticates with email and password against Everly backend
 */
export async function authenticateWithPassword(email: string, password: string): Promise<AuthorizedUser> {
  const cleanEmail = email.toLowerCase().trim();
  if (!isEmailAuthorized(cleanEmail)) {
    recordDeniedAttempt(cleanEmail);
    throw new Error('This email address is not authorized to access Everly.');
  }

  let res: Response;
  try {
    res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password }),
    });

    if (res.status === 404) {
      // Retry via /auth/login in case prefix was stripped by proxy
      res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password }),
      });
    }
  } catch (netErr: any) {
    throw new Error('Authentication service is unreachable. Please verify network connectivity.');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (data.needsSetup) {
      const setupErr = new Error(data.error || 'Password setup required.');
      (setupErr as any).needsSetup = true;
      (setupErr as any).email = cleanEmail;
      throw setupErr;
    }
    throw new Error(data.error || `Authentication failed (HTTP ${res.status}).`);
  }

  const userRecord = data.user;
  const user: AuthorizedUser = {
    email: userRecord.email,
    name: userRecord.name,
    role: userRecord.role,
    avatarInitials: userRecord.avatarInitials,
    avatarColor: userRecord.avatarColor,
    googleSub: userRecord.email,
  };

  const sessionToken = data.token || userRecord.sessionToken;
  setStoredUser(user, sessionToken);
  clearDeniedAttempt();
  return user;
}

/**
 * Sets up initial password or resets password for an authorized account
 */
export async function setupUserPasswordApi(email: string, password: string): Promise<AuthorizedUser> {
  const cleanEmail = email.toLowerCase().trim();
  if (!isEmailAuthorized(cleanEmail)) {
    throw new Error('Unauthorized email address.');
  }

  let res: Response;
  try {
    res = await fetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password }),
    });

    if (res.status === 404) {
      // Retry via /auth/setup in case prefix was stripped by proxy
      res = await fetch('/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password }),
      });
    }
  } catch (err: any) {
    throw new Error('Authentication service is unreachable. Please verify network connectivity.');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status >= 500) {
      console.error('[AuthService] /api/auth/setup failed:', res.status, data);
    } else {
      console.info('[AuthService] /api/auth/setup response:', res.status, data?.error);
    }
    throw new Error(data.error || `Password setup failed (HTTP ${res.status}).`);
  }

  const userRecord = data.user;
  const user: AuthorizedUser = {
    email: userRecord.email,
    name: userRecord.name,
    role: userRecord.role,
    avatarInitials: userRecord.avatarInitials,
    avatarColor: userRecord.avatarColor,
    googleSub: userRecord.email,
  };

  const sessionToken = data.token || userRecord.sessionToken;
  setStoredUser(user, sessionToken);
  clearDeniedAttempt();
  return user;
}

export const isEmailAuthorized = (email: string): boolean => {
  if (!email || !email.includes('@')) return false;
  const lower = email.toLowerCase().trim();
  return lower === PRIMARY_OWNER_EMAIL || lower === SHARED_USER_EMAIL;
};

export const getUserRole = (email: string): UserRole => {
  if (!email) return 'Member';
  const normalized = email.trim().toLowerCase();
  if (normalized === PRIMARY_OWNER_EMAIL || normalized === SHARED_USER_EMAIL) return 'Owner';
  return 'Member';
};

export const getStoredUser = (): AuthorizedUser | null => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.email && isEmailAuthorized(parsed.email)) {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      return {
        ...parsed,
        accessToken: token || parsed.accessToken,
      };
    }
    return null;
  } catch {
    return null;
  }
};

export const getStoredAccessToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const setStoredUser = (user: AuthorizedUser | null, accessToken?: string) => {
  if (user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    if (accessToken) {
      localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    }
    localStorage.removeItem(ACCESS_DENIED_STORAGE_KEY);
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
};

export const recordDeniedAttempt = (attemptedEmail: string) => {
  localStorage.setItem(
    ACCESS_DENIED_STORAGE_KEY,
    JSON.stringify({
      email: attemptedEmail,
      timestamp: new Date().toISOString(),
      message: 'This email address is not authorized to access Everly.',
    })
  );
};

export const getDeniedAttempt = (): { email: string; timestamp: string; message: string } | null => {
  try {
    const raw = localStorage.getItem(ACCESS_DENIED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearDeniedAttempt = () => {
  localStorage.removeItem(ACCESS_DENIED_STORAGE_KEY);
};

export async function signOutEverly(): Promise<void> {
  setStoredUser(null);
  clearDeniedAttempt();
}

/**
 * Access Control Permission Helpers
 */
export const canManageSettings = (user: AuthorizedUser | null): boolean => {
  if (!user) return false;
  return user.role === 'Owner' || user.email.toLowerCase() === PRIMARY_OWNER_EMAIL;
};

export const canDeleteFile = (user: AuthorizedUser | null, fileAuthorEmail: string): boolean => {
  if (!user) return false;
  if (user.role === 'Owner') return true;
  return user.email.toLowerCase() === fileAuthorEmail.toLowerCase();
};

export const canUpload = (user: AuthorizedUser | null): boolean => {
  return Boolean(user && user.email && isEmailAuthorized(user.email));
};
