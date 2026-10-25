// Optimize libuv thread pool for Apple Silicon M4 10-Core CPU architecture
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '10';

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config(); // Fallback

const compression = require('compression');
const http = require('http');
const { Server } = require('socket.io');

const { initializeDatabase } = require('./config/db');
const { authRouter, seedAdmin } = require('./routes/auth');
const registrationRouter = require('./routes/registration');
const adminRouter = require('./routes/admin');
const { createQuizRouter } = require('./routes/quiz');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Tune Node HTTP server for Cloudflare Tunnel (upstream keep-alive > 60s) & 250+ concurrent clients
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.requestTimeout = 30000;
server.maxConnections = 2000;

// Setup Socket.io optimized for Apple Silicon M4 & 250+ concurrent users with native WebSockets
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'], // Prefer native WebSockets first
  pingInterval: 25000,
  pingTimeout: 30000,
  perMessageDeflate: false, // Critical: Disabling deflate avoids CPU spikes during 250+ broadcasts
  httpCompression: false,   // Keeps socket framing fast and lightweight on M4
  serveClient: false,       // Client bundle already includes socket.io-client
  maxHttpBufferSize: 1e6,
});

// Track live online participants in memory
let liveParticipants = new Set();
let activeQuizTakers = new Set();
let lastBroadcastStats = { online: 0, activeTakers: 0 };

// Debounce stats broadcasts so 250+ simultaneous connections do not saturate websocket
let statsTimer = null;
function broadcastStatsThrottled() {
  if (statsTimer) return;
  statsTimer = setTimeout(() => {
    statsTimer = null;
    const currentOnline = liveParticipants.size;
    const currentTakers = activeQuizTakers.size;

    // Only broadcast if stats actually changed
    if (
      currentOnline !== lastBroadcastStats.online ||
      currentTakers !== lastBroadcastStats.activeTakers
    ) {
      lastBroadcastStats = { online: currentOnline, activeTakers: currentTakers };
      // Broadcast to lobby, admin and global listeners
      io.to('room:lobby').to('room:admin').emit('participant_stats', lastBroadcastStats);
      io.emit('participant_stats', lastBroadcastStats);
    }
  }, 3000);
}

io.on('connection', (socket) => {
  liveParticipants.add(socket.id);
  broadcastStatsThrottled();

  // Room Subscription Handling for targeted real-time delivery
  socket.on('join_room', (roomName) => {
    if (roomName && typeof roomName === 'string') {
      socket.join(roomName);
    }
  });

  socket.on('leave_room', (roomName) => {
    if (roomName && typeof roomName === 'string') {
      socket.leave(roomName);
    }
  });

  socket.on('quiz_taking_started', (data) => {
    socket.participantRoll = data?.roll_number;
    socket.join('room:quiz');
    activeQuizTakers.add(socket.id);
    broadcastStatsThrottled();
  });

  socket.on('quiz_taking_ended', () => {
    socket.leave('room:quiz');
    activeQuizTakers.delete(socket.id);
    broadcastStatsThrottled();
  });

  socket.on('disconnect', () => {
    liveParticipants.delete(socket.id);
    activeQuizTakers.delete(socket.id);
    broadcastStatsThrottled();
  });
});

// Middleware
app.use(compression({
  level: 6,
  threshold: 1024,
})); // Compress JSON/HTTP responses for 250+ users
app.use(cors({
  origin: true, // Allow request origin (localhost, LAN, or Cloudflare tunnel)
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically with cache
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d',
}));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/register', registrationRouter);
app.use('/api/admin', adminRouter);
app.use('/api/quiz', createQuizRouter(io));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Drishti API is running with Quiz & Socket.io support',
    online: liveParticipants.size,
    active_quiz_takers: activeQuizTakers.size,
  });
});

// Serve frontend production build (SPA) with browser caching for fast phone loads
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath, {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    }
  },
}));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Start server
async function startServer() {
  try {
    await initializeDatabase();
    await seedAdmin();

    // Listen with TCP backlog 511 to prevent dropped connections during simultaneous spikes
    server.listen(PORT, '0.0.0.0', 511, () => {
      console.log(`\n🚀 Drishti Server running on http://localhost:${PORT}`);
      console.log(`⚡ M4 Engine Active: UV_THREADPOOL_SIZE=${process.env.UV_THREADPOOL_SIZE}, TCP Backlog=511, DB Pool=120`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🎯 Quiz API: http://localhost:${PORT}/api/quiz/status`);
      console.log(`🔐 Admin login: POST http://localhost:${PORT}/api/auth/login\n`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

