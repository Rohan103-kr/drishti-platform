const mysql = require('mysql2/promise');
require('dotenv').config();

function parseDatabaseUrlRobust(url) {
  if (!url) return null;
  // Match scheme, user, password (including special chars like @, #, etc.), host, port, db
  const m = url.match(/^mysql(?:2)?:\/\/([^:]+):(.*)@([^:/]+)(?::(\d+))?\/([^?]+)(?:\?(.*))?$/);
  if (m) {
    let rawPass = m[2];
    if (rawPass.startsWith('<') && rawPass.endsWith('>')) {
      rawPass = rawPass.slice(1, -1);
    }
    let dbName = m[5].split('?')[0] || 'test';
    if (dbName === 'sys') dbName = 'test';
    return {
      user: decodeURIComponent(m[1]),
      password: rawPass,
      host: m[3],
      port: parseInt(m[4], 10) || 3306,
      database: dbName
    };
  }
  try {
    const u = new URL(url);
    let rawPass = decodeURIComponent(u.password);
    if (rawPass.startsWith('<') && rawPass.endsWith('>')) {
      rawPass = rawPass.slice(1, -1);
    }
    let dbName = u.pathname.replace(/^\//, '').split('?')[0] || 'test';
    if (dbName === 'sys') dbName = 'test';
    return {
      user: decodeURIComponent(u.username),
      password: rawPass,
      host: u.hostname,
      port: parseInt(u.port, 10) || 3306,
      database: dbName
    };
  } catch (e) {
    return null;
  }
}

let poolConfig = {
  waitForConnections: true,
  connectionLimit: 50,
  queueLimit: 0,
};

const parsedUrl = parseDatabaseUrlRobust(process.env.DATABASE_URL);

if (parsedUrl) {
  poolConfig.host = parsedUrl.host;
  poolConfig.port = parsedUrl.port;
  poolConfig.user = parsedUrl.user;
  poolConfig.password = parsedUrl.password;
  poolConfig.database = parsedUrl.database;
  poolConfig.ssl = { minVersion: 'TLSv1.2', rejectUnauthorized: false };
  console.log(`🔌 Configuring Database connection to ${parsedUrl.host}:${parsedUrl.port} (DB: ${parsedUrl.database}, User: ${parsedUrl.user})`);
} else {
  poolConfig.host = process.env.DB_HOST || 'localhost';
  poolConfig.user = process.env.DB_USER || 'root';
  poolConfig.password = process.env.DB_PASSWORD || '';
  poolConfig.database = process.env.DB_NAME || 'drishti_db';
  poolConfig.port = parseInt(process.env.DB_PORT, 10) || 3306;
  if (process.env.DB_SSL === 'true' || poolConfig.host !== 'localhost') {
    poolConfig.ssl = { minVersion: 'TLSv1.2', rejectUnauthorized: false };
  }
}

const pool = mysql.createPool(poolConfig);

async function initializeDatabase() {
  // Only attempt local database creation if on localhost without DATABASE_URL
  if (!process.env.DATABASE_URL && (!process.env.DB_HOST || process.env.DB_HOST === 'localhost')) {
    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
      });
      await connection.execute(
        `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'drishti_db'}\``
      );
      await connection.end();
    } catch (err) {
      // Ignore if user has no grant permissions or DB already exists
    }
  }

  // Create tables using the pool
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS registrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      roll_number VARCHAR(50) NOT NULL UNIQUE,
      branch VARCHAR(100) NOT NULL,
      section VARCHAR(10) NOT NULL,
      phone VARCHAR(15) NOT NULL,
      email VARCHAR(255) NOT NULL,
      payment_screenshot VARCHAR(500) DEFAULT NULL,
      utr_number VARCHAR(100) DEFAULT NULL,
      qr_token VARCHAR(100) NOT NULL UNIQUE,
      qr_data_url LONGTEXT,
      qr_expired BOOLEAN DEFAULT FALSE,
      verified_at DATETIME DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Quiz Competition Tables
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS quiz_config (
      id INT PRIMARY KEY AUTO_INCREMENT,
      title VARCHAR(255) DEFAULT 'Drishti Speed Quiz Competition',
      duration_seconds INT DEFAULT 300,
      status ENUM('draft', 'live', 'ended') DEFAULT 'draft',
      started_at DATETIME DEFAULT NULL,
      ended_at DATETIME DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id INT PRIMARY KEY AUTO_INCREMENT,
      question_text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_option ENUM('A', 'B', 'C', 'D') NOT NULL,
      marks INT DEFAULT 1,
      order_index INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS quiz_submissions (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      roll_number VARCHAR(50) NOT NULL,
      started_at DATETIME DEFAULT NULL,
      submitted_at DATETIME DEFAULT NULL,
      time_taken_seconds INT DEFAULT 0,
      score INT DEFAULT 0,
      total_marks INT DEFAULT 0,
      answers_json LONGTEXT,
      violation_reason VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Performance Indexes for 250+ concurrent participants
  try {
    await pool.execute(`
      CREATE INDEX idx_submissions_leaderboard 
      ON quiz_submissions (score DESC, time_taken_seconds ASC, submitted_at ASC)
    `);
  } catch (err) {
    // Index might already exist; safely ignore
  }

  try {
    await pool.execute(`
      CREATE INDEX idx_submissions_roll 
      ON quiz_submissions (roll_number)
    `);
  } catch (err) {
    // Index might already exist
  }

  try {
    await pool.execute(`
      CREATE INDEX idx_questions_order 
      ON quiz_questions (order_index ASC, id ASC)
    `);
  } catch (err) {
    // Index might already exist
  }

  // Ensure default config exists
  const [configRows] = await pool.execute('SELECT id FROM quiz_config LIMIT 1');
  if (configRows.length === 0) {
    await pool.execute(`
      INSERT INTO quiz_config (title, duration_seconds, status)
      VALUES ('Drishti 2026 Speed Quiz Challenge', 300, 'draft')
    `);
  }

  // Ensure default starter questions exist if empty
  const [questionRows] = await pool.execute('SELECT id FROM quiz_questions LIMIT 1');
  if (questionRows.length === 0) {
    const starterQuestions = [
      [
        'What is the primary objective of value-based human education promoted by VE Cell?',
        'Maximizing financial wealth',
        'Universal human values & harmonious living',
        'Passing semester exams without studying',
        'Learning pure mechanical coding only',
        'B',
        2,
        1
      ],
      [
        'In ethical decision-making, what does "Right Understanding" primarily lead to?',
        'Confusion and hesitation',
        'Dominance over other competitors',
        'Mutual happiness and mutual prosperity',
        'Isolation from social environments',
        'C',
        2,
        2
      ],
      [
        'Which core value is essential for creating trust and respect in team relationships?',
        'Transparency and empathy',
        'Secretiveness and competition',
        'Authoritarian directives',
        'Indifference to teammates',
        'A',
        2,
        3
      ],
      [
        'What is the time complexity of searching an element in a balanced Binary Search Tree (BST)?',
        'O(1)',
        'O(n)',
        'O(log n)',
        'O(n log n)',
        'C',
        2,
        4
      ],
      [
        'In web development, which browser event is triggered when a user switches tabs or minimizes the window?',
        'tabswitch',
        'visibilitychange',
        'windowleave',
        'pagehideaway',
        'B',
        2,
        5
      ],
      [
        'Which HTTP status code signifies "Unauthorized" access in REST APIs?',
        '200 OK',
        '404 Not Found',
        '401 Unauthorized',
        '500 Internal Server Error',
        'C',
        2,
        6
      ],
      [
        'What does harmonious coexistence in nature and society cultivate?',
        'Resource exploitation',
        'Sustainability and peace',
        'Market volatility',
        'Industrial pollution',
        'B',
        2,
        7
      ],
      [
        'Which data structure operates on a First-In-First-Out (FIFO) principle?',
        'Stack',
        'Queue',
        'Binary Tree',
        'Heap',
        'B',
        2,
        8
      ],
      [
        'In JavaScript, what does `JSON.stringify()` convert an object into?',
        'A JavaScript array',
        'A JSON formatted string',
        'A Document Object Model element',
        'A Binary buffer',
        'B',
        2,
        9
      ],
      [
        'What is Drishti organized by at AKGEC?',
        'Sports Club',
        'Cultural Society',
        'Value Education Cell (VE Cell)',
        'Hostel Committee',
        'C',
        2,
        10
      ]
    ];

    for (const q of starterQuestions) {
      await pool.execute(
        `INSERT INTO quiz_questions (question_text, option_a, option_b, option_c, option_d, correct_option, marks, order_index)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        q
      );
    }
  }

  console.log('✅ Database, quiz tables and seed data initialized successfully');
}

module.exports = { pool, initializeDatabase };
