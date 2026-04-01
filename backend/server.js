const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { initDatabase } = require('./config/database');
const MT5Service = require('./services/mt5Service');
const ProfitTracker = require('./services/profitTracker');
const AggregationService = require('./services/aggregationService');
const BinanceFeed = require('./services/binanceFeed');
const ExecutionEngine = require('./services/executionEngine');
const RiskEngine = require('./services/riskEngine');
const metrics = require('./services/metrics');
const FeeTracker = require('./services/feeTracker');
const mockBotEngine = require('./services/mockBotEngine');
const orderSyncEngine = require('./services/orderSyncEngine');
const trailingStopEngine = require('./services/trailingStopEngine');
const scheduleSyncEngine = require('./services/scheduleSyncEngine');
const commissionEngine = require('./services/commissionEngine');

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Nginx) to get correct Client IP for rate limiting
const server = http.createServer(app);

// =============================================
// 🔒 SECURITY: CORS Whitelist
// =============================================
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173'];

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// =============================================
// 🔒 SECURITY: Helmet (Security Headers)
// =============================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Disable CSP for API server
}));

// =============================================
// 🔒 SECURITY: CORS
// =============================================
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// =============================================
// 🔒 SECURITY: Rate Limiting
// =============================================
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 30 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later.' },
});

const tradeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 trade actions per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many trade requests, please slow down.' },
});

app.use('/api', generalLimiter);

// 📊 Metrics middleware (counts requests)
app.use(metrics.middleware());

app.use(express.json({ limit: '10mb' }));

// =============================================
// Routes
// =============================================
const authRoutes = require('./routes/auth');
const mfaRoutes = require('./routes/mfa');
const dashboardRoutes = require('./routes/dashboard');
const accountsRoutes = require('./routes/accounts');
const walletRoutes = require('./routes/wallet');
const botsRoutes = require('./routes/bots');
const tradesRoutes = require('./routes/trades');
const groupsRoutes = require('./routes/groups');
const targetsRoutes = require('./routes/targets');
const webhookRoutes = require('./routes/webhooks');
const adminRoutes = require('./routes/admin');
const reportsRoutes = require('./routes/reports');
const settingsRoutes = require('./routes/settings');
const storeRoutes = require('./routes/store');
const brokersRoutes = require('./routes/brokers');
const billingRoutes = require('./routes/billing');
const strategiesRoutes = require('./routes/strategies');
const forumsRoutes = require('./routes/forums');
const notificationsRoutes = require('./routes/notifications');
const agentsRoutes = require('./routes/agents');

// Apply stricter rate limits to sensitive routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/mfa', authLimiter, mfaRoutes);
app.use('/api/trades', tradeLimiter, tradesRoutes);

app.use('/api/brokers', brokersRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/bots', botsRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/targets', targetsRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/strategies', strategiesRoutes);
app.use('/api/forums', forumsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/agents', agentsRoutes);

// =============================================
// Swagger API Docs (Level 3)
// =============================================
try {
  const swaggerJsDoc = require('swagger-jsdoc');
  const swaggerUi = require('swagger-ui-express');

  const swaggerOptions = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'NexusFX Trading Platform API',
        version: '1.0.0',
        description: 'API documentation for NexusFX — a multi-broker trading platform with group management, automated bots, and analytics.',
        contact: { name: 'NexusFX Dev Team' },
      },
      servers: [
        { url: `http://localhost:${process.env.PORT || 4000}/api`, description: 'Development' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      security: [{ bearerAuth: [] }],
    },
    apis: ['./routes/*.js'],
  };

  const swaggerDocs = swaggerJsDoc(swaggerOptions);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'NexusFX API Docs',
  }));
  console.log('📖 Swagger API docs available at /api-docs');
} catch (err) {
  console.warn('⚠️ Swagger not available:', err.message);
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// 📊 Prometheus Metrics Endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(await metrics.toPrometheusText());
  } catch (err) {
    res.status(500).send('# Error collecting metrics');
  }
});

// Socket.io
io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  socket.on('join', (userId) => {
    socket.join(`user:${userId}`);
    console.log(`   User ${userId} joined room`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// Initialize services
const ms = new MT5Service(io);
const profitTracker = new ProfitTracker(io);
const aggregationService = new AggregationService();
const feeTracker = new FeeTracker();
const binanceFeed = new BinanceFeed(io);
const executionEngine = new ExecutionEngine();
const riskEngine = new RiskEngine(io);

// Notification Service (in-app + socket.io)
const NotificationService = require('./services/notificationService');
const notificationService = new NotificationService(io);
executionEngine.setNotificationService(notificationService);
orderSyncEngine.setNotificationService(notificationService);

// Store services for route access
app.set('mt5Service', ms);
app.set('io', io);

// Start server
const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await initDatabase();
    await ms.init();
    profitTracker.start();
    aggregationService.start();
    feeTracker.start();
    orderSyncEngine.start();
    scheduleSyncEngine.start();
    binanceFeed.start();
    executionEngine.start();
    riskEngine.start();
    // ⚠️ ข้อ 2: ปิดระบบเทรดจำลอง (Mock Bot Engine) สำหรับ Production เพื่อไม่ให้กราฟวิ่งสุ่มแบบหลอกๆ
    // mockBotEngine.setIo(io);
    // mockBotEngine.start();
    trailingStopEngine.setIo(io);
    trailingStopEngine.start();
    commissionEngine.start();

    server.listen(PORT, () => {
      console.log(`\n🚀 NexusFX Backend running on http://localhost:${PORT}`);
      console.log(`   API: http://localhost:${PORT}/api`);
      console.log(`   Docs: http://localhost:${PORT}/api-docs`);
      console.log(`   Metrics: http://localhost:${PORT}/metrics`);
      console.log(`   Socket.io: ws://localhost:${PORT}`);
      console.log(`   CORS: ${ALLOWED_ORIGINS.join(', ')}`);
      console.log(`   Security: Helmet ✅ | Rate Limit ✅ | Encryption ✅ | Metrics ✅\n`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();
