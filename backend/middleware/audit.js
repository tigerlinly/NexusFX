const { pool } = require('../config/database');

const auditLogger = (action, entityType) => {
  return async (req, res, next) => {
    // We capture the original end method to intercept the response
    const originalEnd = res.end;
    
    res.end = function (chunk, encoding) {
      // Re-assign back to original
      res.end = originalEnd;
      res.end(chunk, encoding);

      // Only log if the action was successful or mostly successful (2xx, 3xx)
      if (res.statusCode >= 200 && res.statusCode < 400) {
        // Try to capture entity ID from params or body
        const entityId = req.params.id || req.body?.id || null;
        
        // Log asynchronously, no need to wait
        pool.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            req.user?.id || null,
            action,
            entityType,
            entityId,
            JSON.stringify(req.body || {}),
            req.ip || req.connection.remoteAddress
          ]
        ).catch(err => console.error('[AuditLogger] Failed to log:', err.message));
      }
    };
    
    next();
  };
};

module.exports = { auditLogger };
