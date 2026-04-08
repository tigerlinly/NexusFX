const { pool } = require('../config/database');

class SystemConfigService {
  constructor() {
    this.cache = {};
    this.lastFetched = 0;
    this.cacheTtl = 60000; // 1 minute cache
  }

  async fetchAll() {
    try {
      const result = await pool.query('SELECT key, value FROM system_config');
      const newCache = {};
      for (const row of result.rows) {
        newCache[row.key] = row.value;
      }
      this.cache = newCache;
      this.lastFetched = Date.now();
      return this.cache;
    } catch (err) {
      if (err.code === '42P01') {
        // Table does not exist yet (during initial startup/migrations)
        return {};
      }
      console.error('SystemConfig fetch error:', err);
      return this.cache; // return stale cache if db fails
    }
  }

  async get(key, defaultValue = null) {
    if (Date.now() - this.lastFetched > this.cacheTtl) {
      await this.fetchAll();
    }
    const val = this.cache[key];
    if (val === undefined || val === null) return defaultValue;
    
    // Parse booleans and numbers if applicable
    if (val === 'true') return true;
    if (val === 'false') return false;
    if (!isNaN(val) && val.trim() !== '') return Number(val);
    
    return val;
  }

  async refresh() {
    await this.fetchAll();
  }
}

module.exports = new SystemConfigService();
