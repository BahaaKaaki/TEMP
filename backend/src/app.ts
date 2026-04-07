import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { env } from './config/env';
import { httpLogStream, logger } from './config/logger';
import { errorHandler, notFoundHandler } from './common/middleware/error.middleware';
import { standardLimiter } from './common/middleware/rate-limit.middleware';

// Route imports
import authRoutes from './modules/auth/auth.routes';
import organizationsRoutes from './modules/organizations/organizations.routes';
import themesRoutes from './modules/themes/themes.routes';
import templatesRoutes, { pptxMasterTemplatesRouter } from './modules/templates/templates.routes';
import aiProxyRoutes from './modules/ai-proxy/ai-proxy.routes';

const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// CORS configuration - allow all origins in development
app.use(cors({
  origin: env.NODE_ENV === 'development' ? true : env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-Id'],
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// HTTP logging
if (env.NODE_ENV !== 'test') {
  app.use(morgan('combined', { stream: httpLogStream }));
}

// Rate limiting
app.use('/api/', standardLimiter);

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// API routes
app.use('/api/templates', pptxMasterTemplatesRouter);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/organizations', organizationsRoutes);
app.use('/api/v1/themes', themesRoutes);
app.use('/api/v1/templates', templatesRoutes);

// AI proxy (no auth required -- frontend calls this to reach PwC Shared Services)
app.use('/api/ai', aiProxyRoutes);

// In production, serve the built React frontend as static files
const frontendPath = path.join(__dirname, '../public');
app.use(express.static(frontendPath));
app.get('*', (_req, res, next) => {
  const indexPath = path.join(frontendPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) next();
  });
});

// Error handling
app.use(errorHandler);

export default app;
