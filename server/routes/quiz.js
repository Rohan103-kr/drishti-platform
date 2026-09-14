const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

function createQuizRouter(io) {
  const router = express.Router();

  // --- IN-MEMORY HIGH-SPEED CACHES (FOR 250+ CONCURRENT USERS) ---
  let cachedQuestionsPublic = null;
  let cachedQuestionsAdmin = null;
  let cachedConfig = null;
  let cachedLeaderboard = null;
  let lastLeaderboardFetch = 0;

  // Invalidate in-memory caches
  const invalidateQuestionCache = () => {
    cachedQuestionsPublic = null;
    cachedQuestionsAdmin = null;
    cachedConfig = null;
  };

  const invalidateLeaderboardCache = () => {
    cachedLeaderboard = null;
    lastLeaderboardFetch = 0;
  };

  // Helper to format seconds to mm:ss
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Helper to fetch live leaderboard with short 1-sec cache for high concurrency
  async function getLeaderboardData() {
    const now = Date.now();
    if (cachedLeaderboard && now - lastLeaderboardFetch < 1000) {
      return cachedLeaderboard;
    }

    const [rows] = await pool.execute(`
      SELECT id, name, roll_number, score, total_marks, time_taken_seconds, violation_reason, submitted_at
      FROM quiz_submissions
      ORDER BY score DESC, time_taken_seconds ASC, submitted_at ASC
    `);

    const data = rows.map((row, idx) => {
      let badge = '';
      if (idx === 0) badge = '🥇';
      else if (idx === 1) badge = '🥈';
      else if (idx === 2) badge = '🥉';

      return {
        rank: idx + 1,
        badge,
        name: row.name,
        roll_number: row.roll_number,
        score: row.score,
        total_marks: row.total_marks,
        time_taken_seconds: row.time_taken_seconds,
        formatted_time: formatDuration(row.time_taken_seconds || 0),
        violation_reason: row.violation_reason,
        is_disqualified: !!row.violation_reason,
        submitted_at: row.submitted_at,
      };
    });

    cachedLeaderboard = data;
    lastLeaderboardFetch = now;
    return data;
  }

  // Throttled broadcast for 250+ concurrent users:
  // Prevents broadcast flood when multiple participants submit in the same second
  let broadcastTimer = null;
  function scheduleLeaderboardBroadcast() {
    if (broadcastTimer) return;
    broadcastTimer = setTimeout(async () => {
      broadcastTimer = null;
      try {
        invalidateLeaderboardCache();
        const leaderboard = await getLeaderboardData();
        if (io) {
          io.emit('leaderboard_update', leaderboard);
        }
      } catch (err) {
        console.error('Error in throttled leaderboard broadcast:', err);
      }
    }, 1000);
  }

  // --- PUBLIC PARTICIPANT ROUTES ---

  // Get current competition status & config (cached for sub-millisecond response)
  router.get('/status', async (req, res) => {
    try {
      if (!cachedConfig) {
        const [configs] = await pool.execute(
          'SELECT * FROM quiz_config ORDER BY id DESC LIMIT 1'
        );
        const config = configs[0] || {
          status: 'draft',
          duration_seconds: 300,
          title: 'Drishti Speed Quiz',
        };

        const [questionCount] = await pool.execute(
          'SELECT COUNT(*) as count, COALESCE(SUM(marks), 0) as total_marks FROM quiz_questions'
        );

        const [participantCount] = await pool.execute(
          'SELECT COUNT(*) as count FROM quiz_submissions'
        );

        cachedConfig = {
          title: config.title,
          status: config.status,
          duration_seconds: config.duration_seconds,
          started_at: config.started_at,
          ended_at: config.ended_at,
          total_questions: questionCount[0].count,
          total_possible_marks: Number(questionCount[0].total_marks),
          total_submissions: participantCount[0].count,
        };
      }

      res.json(cachedConfig);
    } catch (err) {
      console.error('Error getting quiz status:', err);
      res.status(500).json({ error: 'Failed to fetch quiz status' });
    }
  });

  // Get questions for participant WITHOUT correct_option (Served from RAM for 250+ users)
  router.get('/questions', async (req, res) => {
    try {
      if (!cachedQuestionsPublic) {
        const [questions] = await pool.execute(`
          SELECT id, question_text, option_a, option_b, option_c, option_d, marks, order_index
          FROM quiz_questions
          ORDER BY order_index ASC, id ASC
        `);
        cachedQuestionsPublic = questions;
      }
      res.json({ questions: cachedQuestionsPublic });
    } catch (err) {
      console.error('Error fetching questions:', err);
      res.status(500).json({ error: 'Failed to fetch questions' });
    }
  });

  // Participant submits answers
  router.post('/submit', async (req, res) => {
    try {
      const { name, roll_number, answers = {}, time_taken_seconds = 0, violation_reason = null } = req.body;

      if (!name || !roll_number) {
        return res.status(400).json({ error: 'Name and Roll Number are required' });
      }

      const cleanRoll = roll_number.trim().toUpperCase();

      // Check if participant already submitted
      const [existing] = await pool.execute(
        'SELECT id FROM quiz_submissions WHERE roll_number = ? LIMIT 1',
        [cleanRoll]
      );

      if (existing.length > 0) {
        return res.status(400).json({ error: 'You have already submitted this quiz once.' });
      }

      // Fetch questions and correct answers (use admin cached questions for instant memory evaluation)
      if (!cachedQuestionsAdmin) {
        const [qs] = await pool.execute('SELECT id, correct_option, marks FROM quiz_questions');
        cachedQuestionsAdmin = qs;
      }

      let score = 0;
      let total_marks = 0;

      cachedQuestionsAdmin.forEach((q) => {
        total_marks += Number(q.marks || 1);
        const participantChoice = answers[q.id];
        if (participantChoice && participantChoice.toUpperCase() === q.correct_option.toUpperCase()) {
          score += Number(q.marks || 1);
        }
      });

      const safeTimeTaken = Math.max(0, parseInt(time_taken_seconds, 10) || 0);

      await pool.execute(
        `INSERT INTO quiz_submissions 
        (name, roll_number, started_at, submitted_at, time_taken_seconds, score, total_marks, answers_json, violation_reason)
        VALUES (?, ?, NOW(), NOW(), ?, ?, ?, ?, ?)`,
        [
          name.trim(),
          cleanRoll,
          safeTimeTaken,
          score,
          total_marks,
          JSON.stringify(answers),
          violation_reason || null,
        ]
      );

      // Invalidate leaderboard cache and schedule broadcast
      invalidateLeaderboardCache();
      scheduleLeaderboardBroadcast();

      // Send immediate lightweight event for instant feedback
      if (io) {
        io.emit('submission_received', {
          name: name.trim(),
          score,
          total_marks,
          formatted_time: formatDuration(safeTimeTaken),
          violation: violation_reason,
        });
      }

      // Update cached total submissions
      if (cachedConfig) {
        cachedConfig.total_submissions = (cachedConfig.total_submissions || 0) + 1;
      }

      res.status(201).json({
        success: true,
        score,
        total_marks,
        time_taken_seconds: safeTimeTaken,
        formatted_time: formatDuration(safeTimeTaken),
        violation_reason,
        is_disqualified: !!violation_reason,
      });
    } catch (err) {
      console.error('Error submitting quiz:', err);
      res.status(500).json({ error: 'Failed to submit quiz results' });
    }
  });

  // Get current live leaderboard
  router.get('/leaderboard', async (req, res) => {
    try {
      const leaderboard = await getLeaderboardData();
      res.json({ leaderboard });
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
  });

  // --- ADMIN / HOST PANEL ROUTES (PROTECTED) ---

  // Get all questions with answers
  router.get('/admin/questions', authenticateToken, async (req, res) => {
    try {
      const [questions] = await pool.execute(`
        SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, order_index
        FROM quiz_questions
        ORDER BY order_index ASC, id ASC
      `);
      cachedQuestionsAdmin = questions;
      res.json({ questions });
    } catch (err) {
      console.error('Admin get questions error:', err);
      res.status(500).json({ error: 'Failed to get questions' });
    }
  });

  // Smart Auto-Decide / Detect Correct Answer endpoint
  router.post('/admin/auto-solve', authenticateToken, (req, res) => {
    try {
      const { question_text = '', option_a = '', option_b = '', option_c = '', option_d = '' } = req.body;

      const qLower = question_text.toLowerCase();
      const opts = [
        { key: 'A', text: option_a },
        { key: 'B', text: option_b },
        { key: 'C', text: option_c },
        { key: 'D', text: option_d },
      ];

      // Heuristic Scoring for auto-detection
      // 1. Check for standard definitive keywords in human values, computing, and science
      const positiveKeywords = [
        'universal', 'harmony', 'happiness', 'prosperity', 'ethical', 'empathy', 'mutual',
        'transparency', 'sustainability', 'peace', 'o(log n)', 'fifo', 'json', 've cell',
        'queue', 'binary search', 'visibilitychange', '401', '404', '200', 'all of the above',
        'true', 'both a and b', 'right understanding', 'respect', 'trust'
      ];

      const negativeKeywords = [
        'none of the above', 'greed', 'exploitation', 'confusion', 'authoritarian',
        'pollution', 'waste', 'mechanical only'
      ];

      let bestOption = 'A';
      let maxScore = -999;

      opts.forEach((opt) => {
        let score = 0;
        const text = opt.text.toLowerCase().trim();

        positiveKeywords.forEach((kw) => {
          if (text.includes(kw)) score += 5;
        });

        negativeKeywords.forEach((nkw) => {
          if (text.includes(nkw)) score -= 4;
        });

        // Exact match with question context
        const words = text.split(/\s+/);
        words.forEach((w) => {
          if (w.length > 3 && qLower.includes(w)) score += 2;
        });

        if (score > maxScore) {
          maxScore = score;
          bestOption = opt.key;
        }
      });

      res.json({
        recommended_option: bestOption,
        confidence: maxScore > 2 ? 'high' : 'medium',
      });
    } catch (err) {
      console.error('Auto solve error:', err);
      res.status(500).json({ error: 'Failed to auto-detect answer' });
    }
  });

  // Create new question
  router.post('/admin/questions', authenticateToken, async (req, res) => {
    try {
      const { question_text, option_a, option_b, option_c, option_d, correct_option, marks = 1 } = req.body;

      if (!question_text || !option_a || !option_b || !option_c || !option_d || !correct_option) {
        return res.status(400).json({ error: 'All fields and options A, B, C, D are required' });
      }

      const [maxOrder] = await pool.execute('SELECT COALESCE(MAX(order_index), 0) + 1 as next_order FROM quiz_questions');
      const order_index = maxOrder[0].next_order;

      const [result] = await pool.execute(
        `INSERT INTO quiz_questions 
        (question_text, option_a, option_b, option_c, option_d, correct_option, marks, order_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [question_text, option_a, option_b, option_c, option_d, correct_option.toUpperCase(), parseInt(marks, 10) || 1, order_index]
      );

      invalidateQuestionCache();

      res.status(201).json({ message: 'Question created successfully', id: result.insertId });
    } catch (err) {
      console.error('Admin create question error:', err);
      res.status(500).json({ error: 'Failed to create question' });
    }
  });

  // Update question
  router.put('/admin/questions/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { question_text, option_a, option_b, option_c, option_d, correct_option, marks } = req.body;

      await pool.execute(
        `UPDATE quiz_questions 
         SET question_text = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_option = ?, marks = ?
         WHERE id = ?`,
        [question_text, option_a, option_b, option_c, option_d, correct_option.toUpperCase(), parseInt(marks, 10) || 1, id]
      );

      invalidateQuestionCache();

      res.json({ message: 'Question updated successfully' });
    } catch (err) {
      console.error('Admin update question error:', err);
      res.status(500).json({ error: 'Failed to update question' });
    }
  });

  // Delete question
  router.delete('/admin/questions/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      await pool.execute('DELETE FROM quiz_questions WHERE id = ?', [id]);

      invalidateQuestionCache();

      res.json({ message: 'Question deleted successfully' });
    } catch (err) {
      console.error('Admin delete question error:', err);
      res.status(500).json({ error: 'Failed to delete question' });
    }
  });

  // Update competition duration (in seconds or minutes)
  router.post('/admin/duration', authenticateToken, async (req, res) => {
    try {
      const { duration_seconds, duration_minutes } = req.body;

      let totalSeconds = 300;
      if (duration_seconds) {
        totalSeconds = parseInt(duration_seconds, 10);
      } else if (duration_minutes) {
        totalSeconds = parseInt(duration_minutes, 10) * 60;
      }

      if (isNaN(totalSeconds) || totalSeconds < 30 || totalSeconds > 7200) {
        return res.status(400).json({ error: 'Duration must be between 30 seconds and 120 minutes.' });
      }

      await pool.execute(
        'UPDATE quiz_config SET duration_seconds = ? ORDER BY id DESC LIMIT 1',
        [totalSeconds]
      );

      cachedConfig = null;

      // Broadcast duration update to all participants live
      if (io) {
        io.emit('duration_updated', { duration_seconds: totalSeconds });
        io.emit('competition_status_changed', { duration_seconds: totalSeconds });
      }

      res.json({ message: 'Quiz duration updated successfully', duration_seconds: totalSeconds });
    } catch (err) {
      console.error('Admin duration update error:', err);
      res.status(500).json({ error: 'Failed to update quiz duration' });
    }
  });

  // Update competition status (Start / Stop / Draft) & timer
  router.post('/admin/status', authenticateToken, async (req, res) => {
    try {
      const { status, duration_seconds = 300, title } = req.body;

      if (!['draft', 'live', 'ended'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be draft, live, or ended.' });
      }

      let query = `UPDATE quiz_config SET status = ?, duration_seconds = ?`;
      const params = [status, parseInt(duration_seconds, 10) || 300];

      if (title) {
        query += `, title = ?`;
        params.push(title);
      }

      if (status === 'live') {
        query += `, started_at = NOW()`;
      } else if (status === 'ended') {
        query += `, ended_at = NOW()`;
      }

      query += ` ORDER BY id DESC LIMIT 1`;

      await pool.execute(query, params);

      cachedConfig = null;

      // Broadcast status change immediately to all connected participants
      if (io) {
        io.emit('competition_status_changed', {
          status,
          duration_seconds: parseInt(duration_seconds, 10) || 300,
          timestamp: new Date().toISOString(),
        });
      }

      res.json({ message: `Competition status updated to ${status}`, status, duration_seconds });
    } catch (err) {
      console.error('Admin status update error:', err);
      res.status(500).json({ error: 'Failed to update competition status' });
    }
  });

  // Reset quiz competition & clear submissions
  router.post('/admin/reset', authenticateToken, async (req, res) => {
    try {
      await pool.execute('DELETE FROM quiz_submissions');
      await pool.execute("UPDATE quiz_config SET status = 'draft', started_at = NULL, ended_at = NULL ORDER BY id DESC LIMIT 1");

      invalidateLeaderboardCache();
      cachedConfig = null;

      const leaderboard = [];
      if (io) {
        io.emit('competition_status_changed', { status: 'draft' });
        io.emit('leaderboard_update', leaderboard);
      }

      res.json({ message: 'All submissions cleared and quiz reset to draft' });
    } catch (err) {
      console.error('Admin reset error:', err);
      res.status(500).json({ error: 'Failed to reset competition' });
    }
  });

  // Export results as CSV
  router.get('/admin/export', authenticateToken, async (req, res) => {
    try {
      const leaderboard = await getLeaderboardData();

      let csv = 'Rank,Name,Roll Number,Score,Total Marks,Percentage,Time Taken,Violation / Disqualification,Submitted At\n';

      leaderboard.forEach((item) => {
        const percentage = item.total_marks > 0 ? ((item.score / item.total_marks) * 100).toFixed(1) : '0';
        const violation = item.violation_reason ? `"${item.violation_reason.replace(/"/g, '""')}"` : 'None';
        const name = `"${item.name.replace(/"/g, '""')}"`;
        const date = item.submitted_at ? new Date(item.submitted_at).toLocaleString() : '';

        csv += `${item.rank},${name},${item.roll_number},${item.score},${item.total_marks},${percentage}%,${item.formatted_time},${violation},${date}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="drishti_quiz_leaderboard.csv"');
      res.status(200).send(csv);
    } catch (err) {
      console.error('Admin export error:', err);
      res.status(500).json({ error: 'Failed to export results' });
    }
  });

  return router;
}

module.exports = { createQuizRouter };
