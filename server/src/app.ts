import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import express, { Router, type RequestHandler } from 'express';
import helmet from 'helmet';
import { createServer } from 'node:http';

import { env } from './config/env.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { tenantContext } from './middleware/tenant.js';
import { attendanceRouter } from './routes/attendance.routes.js';
import { authRouter, meHandler } from './routes/auth.routes.js';
import { batchRouter } from './routes/batch.routes.js';
import { healthRouter, tenantHealthHandler } from './routes/health.routes.js';
import { leadRouter } from './routes/lead.routes.js';
import { webhookRouter } from './routes/webhooks.js';
import { escalationRouter } from './routes/escalation.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { profileRouter } from './routes/profile.routes.js';
import { initializeSocketServer } from './services/socket.service.js';

/**
 * Capture raw body for webhook signature verification.
 * Only applied to the WhatsApp webhook path so other routes get parsed JSON.
 */
const rawBodyCapture: RequestHandler = (req, _res, next) => {
  if (req.path === '/webhooks/whatsapp' && req.method === 'POST') {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string | Buffer) => { data += chunk.toString(); });
    req.on('end', () => {
      (req as any).rawBody = data;
      if (data) {
        try { req.body = JSON.parse(data); } catch { req.body = {}; }
      }
      next();
    });
  } else {
    next();
  }
};

// Strict CORS: only allow explicitly configured origins
function createCorsMiddleware() {
  const allowedOrigins = env.CLIENT_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (allowedOrigins.length === 0) {
    throw new Error('CLIENT_ORIGIN must be configured with at least one allowed origin');
  }

  return cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (no origin header)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS policy: Origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });
}

// Rate limiters for sensitive endpoints
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Try again in 15 minutes.' } },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
  skip: (req) => req.method !== 'POST',
});

const demoLeadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 demo requests per hour per IP
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many demo requests. Try again later.' } },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
  skip: (req) => req.method !== 'POST',
});

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window for forgot-password, resend-verification, register
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again in 15 minutes.' } },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
  skip: (req) => req.method !== 'POST',
});

export function createApp(): { app: express.Express; httpServer: ReturnType<typeof createServer> } {
  const app = express();
  const httpServer = createServer(app);

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", env.CLIENT_ORIGIN],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'same-origin' },
    originAgentCluster: true,
    xContentTypeOptions: true,
    xDnsPrefetchControl: { allow: false },
    xDownloadOptions: true,
    xFrameOptions: { action: 'deny' },
  }));

  // Additional security headers not covered by helmet
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    next();
  });

  // Strict CORS
  app.use(createCorsMiddleware());

  // Cookie parser for refresh token cookies
  app.use(cookieParser());

  // Raw body capture for webhook HMAC verification (must run before express.json)
  app.use(rawBodyCapture);

  // Body parsers with strict limits
  app.use(express.json({ limit: '1mb', strict: true }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  const apiRouter = Router();

  // ---- Public routes -------------------------------------------------------
  apiRouter.use('/health', healthRouter);
  apiRouter.use('/auth', authRouter);
  apiRouter.use('/leads', leadRouter);
  apiRouter.use('/webhooks', webhookRouter);

  // Apply rate limiters to specific public endpoints
  apiRouter.post('/auth/login', loginRateLimiter);
  apiRouter.post('/auth/forgot-password', authRateLimiter);
  apiRouter.post('/auth/resend-verification', authRateLimiter);
  apiRouter.post('/auth/register-institute', authRateLimiter);
  apiRouter.post('/leads/demo', demoLeadRateLimiter);

  // ---- Tenant-scoped routes ------------------------------------------------
  // JWT first, then the transaction-local tenant context. Every handler below
  // can only reach PostgreSQL through req.db (pdo_app + RLS).
  const protectedRouter = Router();
  protectedRouter.use(authMiddleware, tenantContext);
  protectedRouter.get('/auth/me', meHandler);
  protectedRouter.get('/tenant/health', tenantHealthHandler);
  protectedRouter.use('/batches', batchRouter);
  protectedRouter.use('/attendance', attendanceRouter);
  protectedRouter.use('/escalation', escalationRouter);
  protectedRouter.use('/admin', adminRouter);
  protectedRouter.use('/profile', profileRouter);

  apiRouter.use(protectedRouter);

  // Canonical versioned surface plus the /api alias requested by the Phase 1
  // specification. Both resolve to the same handlers and the same middleware.
  app.use('/api/v1', apiRouter);
  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  initializeSocketServer(httpServer);

  return { app, httpServer };
}
