const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

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

// Setup Socket.io with universal CORS for tunnel & local network access
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Track live online participants in memory
let liveParticipants = new Set();
let activeQuizTakers = new Set();

// Debounce stats broadcasts so 250+ simultaneous connections do not saturate websocket
let statsTimer = null;
function broadcastStatsThrottled() {
  if (statsTimer) return;
  statsTimer = setTimeout(() => {
    statsTimer = null;
    io.emit('participant_stats', {
      online: liveParticipants.size,
      activeTakers: activeQuizTakers.size,
    });
  }, 1200);
}

io.on('connection', (socket) => {
  liveParticipants.add(socket.id);
  broadcastStatsThrottled();

  socket.on('quiz_taking_started', (data) => {
    socket.participantRoll = data?.roll_number;
    activeQuizTakers.add(socket.id);
    broadcastStatsThrottled();
  });

  socket.on('quiz_taking_ended', () => {
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
app.use(compression()); // Compress all JSON/HTTP responses for 250+ users
app.use(cors({
  origin: true, // Allow request origin (localhost, LAN, or Cloudflare tunnel)
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/register', registrationRouter);
app.use('/api/admin', adminRouter);
app.use('/api/quiz', createQuizRouter(io));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Drishti API is running with Quiz & Socket.io support' });
});

// Serve frontend production build (SPA)
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

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

    server.listen(PORT, () => {
      console.log(`\n🚀 Drishti Server running on http://localhost:${PORT}`);
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

