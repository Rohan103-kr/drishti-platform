const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
require('dotenv').config();

const router = express.Router();

// Seed default admin on first call
async function seedAdmin() {
  try {
    const [rows] = await pool.execute('SELECT * FROM admins WHERE username = ?', [
      'rohann@123',
    ]);
    if (rows.length === 0) {
      const hash = await bcrypt.hash('root', 12);
      await pool.execute('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [
        'rohann@123',
        hash,
      ]);
      console.log('✅ Default admin seeded (rohann@123)');
    }
  } catch (err) {
    console.error('Error seeding admin:', err.message);
  }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const [rows] = await pool.execute('SELECT * FROM admins WHERE username = ?', [
      username,
    ]);

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const admin = rows[0];
    const isMatch = await bcrypt.compare(password, admin.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      admin: { id: admin.id, username: admin.username },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

module.exports = { authRouter: router, seedAdmin };
