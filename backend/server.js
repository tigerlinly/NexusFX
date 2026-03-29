const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const { initDatabase } = require('./config/database');
const MT5Service = require('./services/mt5Service');
const ProfitTracker = require('./services/profitTracker');
const AggregationService = require('./services/aggregationService');
const BinanceFeed = require('./services/binanceFeed');
const ExecutionEngine = require('./services/executionEngine');
const RiskEngine = require('./services/riskEngine');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
const authRoutes = require('./routes/auth');
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

app.use('/api/auth', authRoutes);
app.use('/api/brokers', brokersRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/bots', botsRoutes);
app.use('/api/trades', tradesRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/targets', targetsRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/store', storeRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
const FeeTracker = require('./services/feeTracker');
const feeTracker = new FeeTracker();
const beeTracker = new FeeTracker();
const binanceFeed = new BinanceFeed(io);
const executionEngine = new ExecutionEngine();
const riskEngine = new RiskEngine();
const mockBotEngine = require('./services/mockBotEngine');

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
    binanceFeed.start();
    executionEngine.start();
    riskEngine.start();
    mockBotEngine.start();

    server.listen(PORT, () => {
      console.log(`\n🚀 NexusFX Backend running on http://localhost:${PORT}`);
      console.log(`   API: http://localhost:${PORT}/api`);
      console.log(`   Socket.io: ws://localhost:${PORT}\n`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();
// bump 
// bump2 
// bump3  
// bump4  
// bump5
// bump6
