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
import templatesRoutes from './modules/templates/templates.routes';

const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/organizations', organizationsRoutes);
app.use('/api/v1/themes', themesRoutes);
app.use('/api/v1/templates', templatesRoutes);

// TODO: Add more routes as we build them
// app.use('/api/v1/users', usersRoutes);
// app.use('/api/v1/decks', decksRoutes);
// app.use('/api/v1/ai', aiRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
