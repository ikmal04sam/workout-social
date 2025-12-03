import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
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
      'INSERT INTO users (username, email, password_hash, bio) VALUES ($1, $2, $3, $4) RETURNING id, username, email, bio, profile_pic, created_at',
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
        profile_pic: user.profile_pic,
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
      'SELECT id, username, email, password_hash, bio, profile_pic, created_at FROM users WHERE username = $1 OR email = $1',
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
        profile_pic: user.profile_pic,
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
      'SELECT id, username, email, bio, profile_pic, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    const [workoutCountResult, followerCountResult, followingCountResult] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM workouts WHERE user_id = $1', [userId]),
      pool.query('SELECT COUNT(*) FROM follows WHERE following_id = $1', [userId]),
      pool.query('SELECT COUNT(*) FROM follows WHERE follower_id = $1', [userId])
    ]);

    const workout_count = parseInt(workoutCountResult.rows[0].count || '0', 10);
    const follower_count = parseInt(followerCountResult.rows[0].count || '0', 10);
    const following_count = parseInt(followingCountResult.rows[0].count || '0', 10);

    res.json({
      user: {
        ...user,
        workout_count,
        follower_count,
        following_count
      }
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile (protected route)
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { bio, profile_pic } = req.body;

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (bio !== undefined) {
      updates.push(`bio = $${paramCount}`);
      values.push(bio || '');
      paramCount++;
    }

    if (profile_pic !== undefined) {
      // Validate profile_pic size (limit to 5MB base64 string, which is ~3.75MB image)
      if (profile_pic && profile_pic.length > 5 * 1024 * 1024) {
        return res.status(400).json({ 
          error: 'Profile picture is too large. Please use a smaller image.' 
        });
      }
      
      updates.push(`profile_pic = $${paramCount}`);
      // Store null if empty string, otherwise store the base64 string
      values.push(profile_pic && profile_pic.trim() !== '' ? profile_pic : null);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Add userId to values array for WHERE clause
    values.push(userId);

    const query = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, username, email, bio, profile_pic, created_at
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: result.rows[0]
    });

  } catch (error: any) {
    console.error('Update profile error:', error);
    // Provide more specific error messages
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Duplicate entry' });
    } else if (error.message && error.message.includes('value too long')) {
      return res.status(400).json({ 
        error: 'Profile picture is too large. Please use a smaller image.' 
      });
    }
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
        u.profile_pic,
        u.created_at,
        COUNT(DISTINCT f1.follower_id) as follower_count,
        COUNT(DISTINCT f2.following_id) as following_count,
        CASE WHEN f3.follower_id IS NOT NULL THEN true ELSE false END as is_following
      FROM users u
      LEFT JOIN follows f1 ON f1.following_id = u.id
      LEFT JOIN follows f2 ON f2.follower_id = u.id
      LEFT JOIN follows f3 ON f3.follower_id = $1 AND f3.following_id = u.id
      WHERE u.username ILIKE $2 AND u.id != $1
      GROUP BY u.id, u.username, u.bio, u.profile_pic, u.created_at, f3.follower_id
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
        u.profile_pic,
        u.created_at,
        COUNT(DISTINCT f1.follower_id) as follower_count,
        COUNT(DISTINCT f2.following_id) as following_count,
        CASE WHEN f3.follower_id IS NOT NULL THEN true ELSE false END as is_following
      FROM users u
      LEFT JOIN follows f1 ON f1.following_id = u.id
      LEFT JOIN follows f2 ON f2.follower_id = u.id
      LEFT JOIN follows f3 ON f3.follower_id = $1 AND f3.following_id = u.id
      WHERE u.id = $2
      GROUP BY u.id, u.username, u.bio, u.profile_pic, u.created_at, f3.follower_id
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

// Get list of users the current user is following
router.get('/following', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;

    const result = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.bio,
        u.profile_pic,
        COUNT(DISTINCT fw.following_id) as following_count,
        COUNT(DISTINCT fr.follower_id) as follower_count
      FROM follows f
      JOIN users u ON f.following_id = u.id
      LEFT JOIN follows fw ON fw.follower_id = u.id
      LEFT JOIN follows fr ON fr.following_id = u.id
      WHERE f.follower_id = $1
      GROUP BY u.id, u.username, u.bio, u.profile_pic
      ORDER BY u.username
    `, [userId]);

    res.json({
      following: result.rows
    });
  } catch (error) {
    console.error('Get following list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recommended users (users not yet followed by current user)
router.get('/recommended', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { limit = 10 } = req.query;

    const result = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.bio,
        u.profile_pic,
        u.created_at,
        COUNT(DISTINCT f1.follower_id) as follower_count,
        COUNT(DISTINCT f2.following_id) as following_count,
        false as is_following
      FROM users u
      LEFT JOIN follows f1 ON f1.following_id = u.id
      LEFT JOIN follows f2 ON f2.follower_id = u.id
      LEFT JOIN follows f3 ON f3.follower_id = $1 AND f3.following_id = u.id
      WHERE u.id != $1 AND f3.follower_id IS NULL
      GROUP BY u.id, u.username, u.bio, u.profile_pic, u.created_at
      ORDER BY COUNT(DISTINCT f1.follower_id) DESC, u.created_at DESC
      LIMIT $2
    `, [userId, parseInt(limit as string)]);

    res.json({
      users: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Get recommended users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get list of users who follow the current user
router.get('/followers', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;

    const result = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.bio,
        u.profile_pic,
        COUNT(DISTINCT fw.following_id) as following_count,
        COUNT(DISTINCT fr.follower_id) as follower_count
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      LEFT JOIN follows fw ON fw.follower_id = u.id
      LEFT JOIN follows fr ON fr.following_id = u.id
      WHERE f.following_id = $1
      GROUP BY u.id, u.username, u.bio, u.profile_pic
      ORDER BY u.username
    `, [userId]);

    res.json({
      followers: result.rows
    });
  } catch (error) {
    console.error('Get followers list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Request password reset endpoint
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    // Validate required fields
    if (!email) {
      return res.status(400).json({ 
        error: 'Email is required' 
      });
    }

    // Find user by email
    const result = await pool.query(
      'SELECT id, email, username FROM users WHERE email = $1',
      [email]
    );

    // Always return success message to prevent email enumeration
    // In production, you would send an email here
    if (result.rows.length > 0) {
      const user = result.rows[0];
      
      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpires = new Date();
      resetTokenExpires.setHours(resetTokenExpires.getHours() + 1); // Token expires in 1 hour

      // Store reset token in database
      await pool.query(
        'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
        [resetToken, resetTokenExpires, user.id]
      );

      // In production, send email with reset link
      // For now, we'll log it (in development only)
      console.log('Password reset token for', user.email, ':', resetToken);
      console.log('Token expires at:', resetTokenExpires);
    }

    // Always return success to prevent email enumeration
    res.json({
      message: 'If an account with that email exists, a password reset token has been generated. Check your email for instructions.'
    });

  } catch (error: any) {
    console.error('Forgot password error:', error);
    // Log more details for debugging
    if (error.code) {
      console.error('Database error code:', error.code);
    }
    if (error.message) {
      console.error('Error message:', error.message);
    }
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Reset password endpoint
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Validate required fields
    if (!token || !newPassword) {
      return res.status(400).json({ 
        error: 'Token and new password are required' 
      });
    }

    // Validate password strength (minimum 6 characters)
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters long' 
      });
    }

    // Find user with valid reset token
    const result = await pool.query(
      'SELECT id, reset_token_expires FROM users WHERE reset_token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid or expired reset token' 
      });
    }

    const user = result.rows[0];

    // Check if token has expired
    if (new Date() > new Date(user.reset_token_expires)) {
      return res.status(400).json({ 
        error: 'Reset token has expired. Please request a new one.' 
      });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password and clear reset token
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [hashedPassword, user.id]
    );

    res.json({
      message: 'Password has been reset successfully. You can now login with your new password.'
    });

  } catch (error: any) {
    console.error('Reset password error:', error);
    // Log more details for debugging
    if (error.code) {
      console.error('Database error code:', error.code);
    }
    if (error.message) {
      console.error('Error message:', error.message);
    }
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
