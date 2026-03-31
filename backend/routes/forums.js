const express = require('express');
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Simple HTML/XSS sanitizer — strips HTML tags, trims whitespace
function sanitize(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

router.use(authMiddleware);

// GET /api/forums - list posts
router.get('/', async (req, res) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let where = '1=1';
    let params = [];
    let idx = 1;

    if (category) {
      where += ` AND category = $${idx++}`;
      params.push(category);
    }
    if (search) {
      where += ` AND (title ILIKE $${idx} OR content ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    const postsQuery = await pool.query(
      `SELECT p.id, p.title, p.content, p.category, p.views, p.created_at, u.username, u.avatar_url,
              (SELECT COUNT(*) FROM forum_comments c WHERE c.post_id = p.id) as comment_count,
              (SELECT COUNT(*) FROM forum_likes l WHERE l.post_id = p.id) as like_count
       FROM forums p
       JOIN users u ON u.id = p.author_id
       WHERE ${where}
       ORDER BY p.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    );

    res.json(postsQuery.rows);
  } catch (err) {
    console.error('Forums get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/forums - create a post
router.post('/', async (req, res) => {
  try {
    const { title, content, category } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const result = await pool.query(
      `INSERT INTO forums (author_id, title, content, category)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, sanitize(title), sanitize(content), sanitize(category) || 'general']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Forums create post error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/forums/:id - get single post and its comments
router.get('/:id', async (req, res) => {
  try {
    // Increment views
    await pool.query('UPDATE forums SET views = views + 1 WHERE id = $1', [req.params.id]);

    const postQuery = await pool.query(
      `SELECT p.*, u.username, u.avatar_url,
              (SELECT COUNT(*) FROM forum_likes l WHERE l.post_id = p.id) as like_count,
              EXISTS (SELECT 1 FROM forum_likes l WHERE l.post_id = p.id AND l.user_id = $2) as is_liked
       FROM forums p
       JOIN users u ON u.id = p.author_id
       WHERE p.id = $1`,
       [req.params.id, req.user.id]
    );

    if (postQuery.rows.length === 0) return res.status(404).json({ error: 'Post not found' });

    const commentsQuery = await pool.query(
      `SELECT c.id, c.content, c.created_at, u.username, u.avatar_url,
              (SELECT COUNT(*) FROM forum_likes l WHERE l.comment_id = c.id) as like_count
       FROM forum_comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
       [req.params.id]
    );

    res.json({
      post: postQuery.rows[0],
      comments: commentsQuery.rows
    });
  } catch (err) {
    console.error('Forums get post error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/forums/:id/comments - add a comment
router.post('/:id/comments', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const result = await pool.query(
      `INSERT INTO forum_comments (post_id, author_id, content)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, req.user.id, sanitize(content)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Forums comment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/forums/:id/like - toggle like
router.post('/:id/like', async (req, res) => {
  try {
    const exists = await pool.query(
      'SELECT id FROM forum_likes WHERE user_id = $1 AND post_id = $2',
      [req.user.id, req.params.id]
    );

    if (exists.rows.length > 0) {
      await pool.query('DELETE FROM forum_likes WHERE user_id = $1 AND post_id = $2', [req.user.id, req.params.id]);
      res.json({ liked: false });
    } else {
      await pool.query(
        'INSERT INTO forum_likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.user.id, req.params.id]
      );
      res.json({ liked: true });
    }
  } catch (err) {
    console.error('Forums like error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/forums/leaderboard - top community members
router.get('/leaderboard', async (req, res) => {
  try {
    // Bypass authMiddleware for leaderboard list view
    const result = await pool.query(`
      SELECT 
        u.id, u.username, u.display_name, u.avatar_url,
        COUNT(DISTINCT f.id) as post_count,
        COUNT(DISTINCT fc.id) as comment_count,
        COALESCE(SUM(
          (SELECT COUNT(*) FROM forum_likes fl WHERE fl.post_id = f.id)
        ), 0) as total_likes,
        COUNT(DISTINCT f.id) * 5 + COUNT(DISTINCT fc.id) * 2 + 
        COALESCE((SELECT COUNT(*) FROM forum_likes fl2 
          JOIN forums f2 ON fl2.post_id = f2.id 
          WHERE f2.author_id = u.id), 0) * 3 as reputation_score
      FROM users u
      LEFT JOIN forums f ON f.author_id = u.id
      LEFT JOIN forum_comments fc ON fc.author_id = u.id
      WHERE u.is_active = true
      GROUP BY u.id, u.username, u.display_name, u.avatar_url
      HAVING COUNT(DISTINCT f.id) > 0 OR COUNT(DISTINCT fc.id) > 0
      ORDER BY reputation_score DESC
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

