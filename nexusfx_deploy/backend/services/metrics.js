const { pool } = require('../config/database');

/**
 * Lightweight Prometheus-compatible metrics collector
 * Exposes /metrics in text/plain format for scraping
 */
class MetricsCollector {
  constructor() {
    this.counters = {};
    this.gauges = {};
    this.histograms = {};
    this.startTime = Date.now();
    
    // Request counters
    this.counters['http_requests_total'] = { help: 'Total HTTP requests', labels: {} };
    this.counters['trade_orders_total'] = { help: 'Total trade orders placed', value: 0 };
    this.counters['auth_login_total'] = { help: 'Total login attempts', value: 0 };
    this.counters['auth_login_failed_total'] = { help: 'Total failed login attempts', value: 0 };
    this.counters['risk_violations_total'] = { help: 'Total risk violations triggered', value: 0 };
    this.counters['line_notify_sent_total'] = { help: 'Total Line Notify messages sent', value: 0 };
  }

  // Increment a counter
  inc(name, labels = {}) {
    if (!this.counters[name]) {
      this.counters[name] = { help: name, value: 0, labels: {} };
    }
    if (Object.keys(labels).length > 0) {
      const key = JSON.stringify(labels);
      if (!this.counters[name].labels) this.counters[name].labels = {};
      this.counters[name].labels[key] = (this.counters[name].labels[key] || 0) + 1;
    } else {
      this.counters[name].value = (this.counters[name].value || 0) + 1;
    }
  }

  // Set a gauge value
  set(name, value, help = '') {
    this.gauges[name] = { help: help || name, value };
  }

  /**
   * Middleware to count requests by method and status
   */
  middleware() {
    return (req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        const method = req.method;
        const status = res.statusCode;
        const route = req.route?.path || req.path || 'unknown';
        
        this.inc('http_requests_total', { method, status: String(status) });
        
        // Track slow requests (> 1s)
        if (duration > 1000) {
          this.inc('http_slow_requests_total', { method, route });
        }
      });
      next();
    };
  }

  /**
   * Collect live system metrics from database
   */
  async collectSystemMetrics() {
    try {
      const [users, accounts, openTrades, activeBots, openOrders, todayPnl] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM users WHERE is_active = true'),
        pool.query('SELECT COUNT(*) FROM accounts WHERE is_active = true'),
        pool.query("SELECT COUNT(*) FROM trades WHERE status = 'OPEN'"),
        pool.query("SELECT COUNT(*) FROM trading_bots WHERE is_active = true"),
        pool.query("SELECT COUNT(*) FROM orders WHERE status = 'PENDING'"),
        pool.query("SELECT COALESCE(SUM(pnl), 0) as total FROM trades WHERE status = 'CLOSED' AND DATE(closed_at) = CURRENT_DATE"),
      ]);

      this.set('nexusfx_active_users', parseInt(users.rows[0].count), 'Number of active users');
      this.set('nexusfx_active_accounts', parseInt(accounts.rows[0].count), 'Number of active trading accounts');
      this.set('nexusfx_open_trades', parseInt(openTrades.rows[0].count), 'Number of currently open trades');
      this.set('nexusfx_active_bots', parseInt(activeBots.rows[0].count), 'Number of active trading bots');
      this.set('nexusfx_pending_orders', parseInt(openOrders.rows[0].count), 'Number of pending orders');
      this.set('nexusfx_today_pnl', parseFloat(todayPnl.rows[0].total), 'Total PnL for today');
      this.set('nexusfx_uptime_seconds', Math.floor((Date.now() - this.startTime) / 1000), 'Server uptime in seconds');

      // Memory usage
      const mem = process.memoryUsage();
      this.set('nodejs_heap_used_bytes', mem.heapUsed, 'Node.js heap used bytes');
      this.set('nodejs_heap_total_bytes', mem.heapTotal, 'Node.js heap total bytes');
      this.set('nodejs_rss_bytes', mem.rss, 'Node.js RSS bytes');
      this.set('nodejs_external_bytes', mem.external, 'Node.js external bytes');

    } catch (err) {
      console.error('[Metrics] Error collecting system metrics:', err.message);
    }
  }

  /**
   * Generate Prometheus-compatible text output
   */
  async toPrometheusText() {
    await this.collectSystemMetrics();
    
    let output = '';

    // Counters
    for (const [name, data] of Object.entries(this.counters)) {
      output += `# HELP ${name} ${data.help}\n`;
      output += `# TYPE ${name} counter\n`;
      
      if (data.labels && Object.keys(data.labels).length > 0) {
        for (const [labelKey, value] of Object.entries(data.labels)) {
          const labels = JSON.parse(labelKey);
          const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');
          output += `${name}{${labelStr}} ${value}\n`;
        }
      } else {
        output += `${name} ${data.value || 0}\n`;
      }
      output += '\n';
    }

    // Gauges
    for (const [name, data] of Object.entries(this.gauges)) {
      output += `# HELP ${name} ${data.help}\n`;
      output += `# TYPE ${name} gauge\n`;
      output += `${name} ${data.value}\n\n`;
    }

    return output;
  }
}

// Singleton
const metrics = new MetricsCollector();

module.exports = metrics;
