const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
require('dotenv').config();

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// Role-based access control middleware
function requireRole(...roleNames) {
  return async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT r.role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
        [req.user.id]
      );
      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'No role assigned' });
      }
      const userRole = result.rows[0].role_name;
      if (!roleNames.includes(userRole)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      req.user.role = userRole;
      next();
    } catch (err) {
      console.error('Role check error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// Permission-based access control middleware
function requirePermission(...permSlugs) {
  return async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT p.slug FROM users u
         JOIN roles r ON r.id = u.role_id
         JOIN role_permissions rp ON rp.role_id = r.id
         JOIN permissions p ON p.id = rp.permission_id
         WHERE u.id = $1 AND p.slug = ANY($2)`,
        [req.user.id, permSlugs]
      );
      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'Permission denied' });
      }
      next();
    } catch (err) {
      console.error('Permission check error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// Audit logger middleware
function auditLog(action, entityType) {
  return async (req, res, next) => {
    // Store original end to hook into response
    const originalEnd = res.end;
    res.end = function (...args) {
      // Log after response is sent
      const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
      pool.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          req.user?.id || null,
          action,
          entityType || null,
          req.params?.id || null,
          JSON.stringify({ method: req.method, path: req.originalUrl, status: res.statusCode }),
          ip,
          req.headers['user-agent'] || null
        ]
      ).catch(err => console.error('Audit log error:', err));
      originalEnd.apply(res, args);
    };
    next();
  };
}

module.exports = { authMiddleware, requireRole, requirePermission, auditLog };
