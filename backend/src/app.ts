import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectDatabase } from './config/database';
import routes from './routes';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.',
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check — BEFORE DB middleware so it always works for diagnostics
let dbConnected = false;
app.get('/health', (_req, res) => {
  res.json({
    status: dbConnected ? 'healthy' : 'degraded',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    env: {
      DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'MISSING',
      RAPIDAPI_KEY: process.env.RAPIDAPI_KEY ? 'set' : 'MISSING',
      RAPIDAPI_HOST: process.env.RAPIDAPI_HOST ? 'set' : 'MISSING',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'set' : 'MISSING',
      WHAPI_TOKEN: process.env.WHAPI_TOKEN ? 'set' : 'MISSING',
    },
  });
});

// Database connection (lazy, once per cold start)
app.use(async (_req, res, next) => {
  if (!dbConnected) {
    try {
      await connectDatabase();
      dbConnected = true;
    } catch (error) {
      console.error('Database connection failed:', error);
      res.status(500).json({ error: 'Database connection failed. Check DATABASE_URL env var.' });
      return;
    }
  }
  next();
});

// Routes
app.use('/api', routes);

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

export default app;
