import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, bio } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ 
        error: 'Username, email, and password are required' 
      });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Username or email already exists' 
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, bio) VALUES ($1, $2, $3, $4) RETURNING id, username, email, bio, created_at',
      [username, email, hashedPassword, bio || '']
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        bio: user.bio,
        created_at: user.created_at
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required' 
      });
    }

    // Find user by username or email
    const result = await pool.query(
      'SELECT id, username, email, password_hash, bio, created_at FROM users WHERE username = $1 OR email = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid credentials' 
      });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ 
        error: 'Invalid credentials' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        bio: user.bio,
        created_at: user.created_at
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile (protected route)
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    // This will be protected by auth middleware
    const userId = (req as any).userId;

    const result = await pool.query(
      'SELECT id, username, email, bio, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search users by username
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q, limit = 20, offset = 0 } = req.query;
    const currentUserId = (req as any).userId;

    if (!q || (q as string).trim().length === 0) {
      return res.json({
        users: [],
        count: 0
      });
    }

    const searchQuery = `%${(q as string).trim()}%`;
    
    // Get users matching search query, excluding current user
    const result = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.bio,
        u.created_at,
        COUNT(DISTINCT f1.follower_id) as follower_count,
        COUNT(DISTINCT f2.following_id) as following_count,
        CASE WHEN f3.follower_id IS NOT NULL THEN true ELSE false END as is_following
      FROM users u
      LEFT JOIN follows f1 ON f1.following_id = u.id
      LEFT JOIN follows f2 ON f2.follower_id = u.id
      LEFT JOIN follows f3 ON f3.follower_id = $1 AND f3.following_id = u.id
      WHERE u.username ILIKE $2 AND u.id != $1
      GROUP BY u.id, u.username, u.bio, u.created_at, f3.follower_id
      ORDER BY u.username
      LIMIT $3 OFFSET $4
    `, [currentUserId, searchQuery, parseInt(limit as string), parseInt(offset as string)]);

    res.json({
      users: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user profile by ID
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = (req as any).userId;

    // Get user info with follower/following counts
    const userResult = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.bio,
        u.created_at,
        COUNT(DISTINCT f1.follower_id) as follower_count,
        COUNT(DISTINCT f2.following_id) as following_count,
        CASE WHEN f3.follower_id IS NOT NULL THEN true ELSE false END as is_following
      FROM users u
      LEFT JOIN follows f1 ON f1.following_id = u.id
      LEFT JOIN follows f2 ON f2.follower_id = u.id
      LEFT JOIN follows f3 ON f3.follower_id = $1 AND f3.following_id = u.id
      WHERE u.id = $2
      GROUP BY u.id, u.username, u.bio, u.created_at, f3.follower_id
    `, [currentUserId, userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: userResult.rows[0]
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
