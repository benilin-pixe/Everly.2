import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import * as authStore from './authStore.ts';

// In-memory rate limiter for auth endpoints (20 attempts per minute per IP)
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();

function checkRateLimit(ip: string, limit = 20, windowMs = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (record.count >= limit) {
    return false;
  }
  record.count += 1;
  return true;
}

/**
 * Sanitizes an auth record to ensure passwords, hashes, and salts are NEVER returned to clients
 */
function sanitizeUser(user: authStore.OwnerAuthRecord, sessionToken?: string) {
  const { passwordHash, passwordSalt, ...safeUser } = user;
  return {
    ...safeUser,
    ...(sessionToken ? { sessionToken } : {}),
  };
}

export function createAuthRouter() {
  const router = express.Router();

  // Authentication configuration and provider status
  router.get('/config', (req: Request, res: Response) => {
    const requestId = crypto.randomUUID();
    res.json({
      authProvider: 'password',
      supportedProviders: ['password'],
      googleAuthOnly: false,
      passwordsEnabled: true,
      requestId,
    });
  });

  // Check account status & setup requirement
  router.get('/status', (req: Request, res: Response) => {
    const requestId = crypto.randomUUID();
    try {
      const store = authStore.loadAuthStore();
      const benilinComplete = store[authStore.BENILIN_EMAIL]?.isSetupComplete || false;
      const shanaComplete = store[authStore.SHANALOVE_EMAIL]?.isSetupComplete || false;

      res.json({
        authProvider: 'password',
        isSetupComplete: benilinComplete && shanaComplete,
        benilinSetupComplete: benilinComplete,
        shanaSetupComplete: shanaComplete,
        passwordsEnabled: true,
        requestId,
      });
    } catch (err: any) {
      console.error(`[Auth:status:${requestId}] Error checking status:`, err?.message || err);
      res.status(500).json({ error: 'Failed to retrieve auth status.', requestId });
    }
  });

  // Secure Password Login
  router.post('/login', (req: Request, res: Response) => {
    const requestId = crypto.randomUUID();
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

    try {
      if (!checkRateLimit(`login_${clientIp}`, 25, 60000)) {
        console.info(`[Auth:login:${requestId}] Rate limit reached for IP: ${clientIp}`);
        res.status(429).json({ error: 'Too many login attempts. Please wait a moment and try again.', requestId });
        return;
      }

      if (!req.body || typeof req.body !== 'object') {
        console.info(`[Auth:login:${requestId}] Invalid JSON body`);
        res.status(400).json({ error: 'Missing or malformed request body.', requestId });
        return;
      }

      const { email, password } = req.body;

      if (!email || typeof email !== 'string' || !email.includes('@')) {
        console.info(`[Auth:login:${requestId}] Invalid or missing email`);
        res.status(400).json({ error: 'Missing or invalid email address.', requestId });
        return;
      }

      const cleanEmail = email.toLowerCase().trim();

      if (!authStore.isAuthorizedUserEmail(cleanEmail)) {
        console.info(`[Auth:login:${requestId}] Login denied for unauthorized email: ${cleanEmail}`);
        res.status(403).json({ error: 'Access denied: this email address is not authorized for Everly.', requestId });
        return;
      }

      if (!password || typeof password !== 'string') {
        console.info(`[Auth:login:${requestId}] Missing password for ${cleanEmail}`);
        res.status(400).json({ error: 'Missing password.', requestId });
        return;
      }

      const result = authStore.authenticateUser({
        email: cleanEmail,
        password,
      });

      if (!result.success || !result.user) {
        if (result.needsSetup) {
          console.info(`[Auth:login:${requestId}] Account needs setup: ${cleanEmail}`);
          res.status(403).json({
            error: 'Password not configured for this account. Please complete initial setup.',
            needsSetup: true,
            email: cleanEmail,
            requestId,
          });
          return;
        }

        const statusCode = result.code || 401;
        console.info(`[Auth:login:${requestId}] Authentication failed for ${cleanEmail}: ${result.error}`);
        res.status(statusCode).json({ error: result.error || 'Authentication failed.', requestId });
        return;
      }

      const sessionToken = crypto.randomBytes(32).toString('hex');
      const safeUser = sanitizeUser(result.user, sessionToken);

      console.info(`[Auth:login:${requestId}] Successful login for authorized owner: ${cleanEmail}`);
      res.json({
        success: true,
        user: safeUser,
        token: sessionToken,
        requestId,
      });
    } catch (err: any) {
      console.error(`[Auth:login:${requestId}] Unexpected server exception during login:`, err?.message || err);
      res.status(500).json({
        error: 'An unexpected internal server error occurred during login. Please try again.',
        requestId,
      });
    }
  });

  // Initial Password Setup / Reset
  router.post('/setup', (req: Request, res: Response) => {
    const requestId = crypto.randomUUID();
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

    try {
      // Stage 1: Request parsing
      console.info(`[Auth:setup:${requestId}] Stage 1: Request parsing - method=${req.method}, contentType=${req.headers['content-type']}, clientIp=${clientIp}`);

      if (!checkRateLimit(`setup_${clientIp}`, 15, 60000)) {
        console.info(`[Auth:setup:${requestId}] Stage 1 failed - rate limit reached for IP: ${clientIp}`);
        res.status(429).json({ error: 'Too many setup attempts. Please wait a moment and try again.', requestId });
        return;
      }

      if (!req.body || typeof req.body !== 'object') {
        console.info(`[Auth:setup:${requestId}] Stage 1 failed - malformed or missing JSON body`);
        res.status(400).json({ error: 'Malformed or missing JSON request body.', requestId });
        return;
      }

      const { email, password } = req.body;

      // Stage 2: Input validation
      console.info(`[Auth:setup:${requestId}] Stage 2: Input validation - emailPresent=${Boolean(email)}, passwordPresent=${Boolean(password)}`);

      if (!email || typeof email !== 'string' || !email.includes('@')) {
        console.info(`[Auth:setup:${requestId}] Stage 2 failed - missing or invalid email format`);
        res.status(400).json({ error: 'A valid email address is required.', requestId });
        return;
      }

      const cleanEmail = email.toLowerCase().trim();

      if (!password || typeof password !== 'string') {
        console.info(`[Auth:setup:${requestId}] Stage 2 failed - missing password`);
        res.status(400).json({ error: 'Password is required.', requestId });
        return;
      }

      if (password.length < 6) {
        console.info(`[Auth:setup:${requestId}] Stage 2 failed - password length ${password.length} < 6`);
        res.status(400).json({ error: 'Password must be at least 6 characters long.', requestId });
        return;
      }

      // Stage 4: Authorization (pre-flight check)
      console.info(`[Auth:setup:${requestId}] Stage 4: Authorization - verifying account whitelist for email: ${cleanEmail}`);
      if (!authStore.isAuthorizedUserEmail(cleanEmail)) {
        console.info(`[Auth:setup:${requestId}] Stage 4 failed - unauthorized email: ${cleanEmail}`);
        res.status(403).json({
          error: 'Access denied: this email address is not an authorized Everly owner.',
          requestId,
        });
        return;
      }

      // Stage 3 & 5 & 6: User lookup, password hashing, and database write
      console.info(`[Auth:setup:${requestId}] Stage 3: User/account lookup - loading account record for: ${cleanEmail}`);
      console.info(`[Auth:setup:${requestId}] Stage 5: Password hashing - computing PBKDF2-SHA512 hash with cryptographic salt`);
      console.info(`[Auth:setup:${requestId}] Stage 6: Database write - writing updated credentials to durable storage`);

      const result = authStore.setupUserPassword({
        email: cleanEmail,
        password,
      });

      if (!result.success || !result.user) {
        const statusCode = result.code || 400;
        if (statusCode >= 500) {
          console.error(`[Auth:setup:${requestId}] Stage 6 failed - write error: ${result.error}`);
        } else {
          console.info(`[Auth:setup:${requestId}] Stage 6 rejected: ${result.error}`);
        }
        res.status(statusCode).json({ error: result.error || 'Password setup failed.', requestId });
        return;
      }

      // Stage 7: Response creation
      console.info(`[Auth:setup:${requestId}] Stage 7: Response creation - generating session token and redacting credentials`);
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const safeUser = sanitizeUser(result.user, sessionToken);

      console.info(`[Auth:setup:${requestId}] Password setup pipeline complete for ${cleanEmail} (role=${safeUser.role})`);
      res.json({
        success: true,
        user: safeUser,
        token: sessionToken,
        requestId,
      });
    } catch (err: any) {
      console.error(`[Auth:setup:${requestId}] Unhandled server exception:`, {
        name: err?.name,
        message: err?.message || String(err),
        stack: err?.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : undefined,
      });
      res.status(500).json({
        error: 'An unexpected internal server error occurred during password setup. Please try again.',
        requestId,
      });
    }
  });

  router.post('/reset', (req: Request, res: Response) => {
    const requestId = crypto.randomUUID();
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

    try {
      if (!checkRateLimit(`reset_${clientIp}`, 15, 60000)) {
        res.status(429).json({ error: 'Too many reset attempts. Please wait a moment and try again.', requestId });
        return;
      }

      if (!req.body || typeof req.body !== 'object') {
        res.status(400).json({ error: 'Missing or malformed request body.', requestId });
        return;
      }

      const { email, password } = req.body;

      if (!email || typeof email !== 'string' || !email.includes('@')) {
        res.status(400).json({ error: 'A valid email address is required.', requestId });
        return;
      }

      const cleanEmail = email.toLowerCase().trim();

      if (!authStore.isAuthorizedUserEmail(cleanEmail)) {
        res.status(403).json({ error: 'Access denied: unauthorized email address.', requestId });
        return;
      }

      if (!password || typeof password !== 'string' || password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters long.', requestId });
        return;
      }

      const result = authStore.setupUserPassword({ email: cleanEmail, password });
      if (!result.success || !result.user) {
        res.status(result.code || 400).json({ error: result.error || 'Password reset failed.', requestId });
        return;
      }

      const sessionToken = crypto.randomBytes(32).toString('hex');
      const safeUser = sanitizeUser(result.user, sessionToken);

      res.json({
        success: true,
        user: safeUser,
        token: sessionToken,
        requestId,
      });
    } catch (err: any) {
      console.error(`[Auth:reset:${requestId}] Unexpected server exception during reset:`, err?.message || err);
      res.status(500).json({
        error: 'An unexpected internal server error occurred during password reset. Please try again.',
        requestId,
      });
    }
  });

  // Permanently retired public registration
  router.post('/register', (_req: Request, res: Response) => {
    res.status(410).json({
      error: 'Public registration is permanently disabled. Everly is a private two-owner workspace for authorized owners only.',
    });
  });

  return router;
}
