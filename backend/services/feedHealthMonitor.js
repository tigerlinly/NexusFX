/**
 * Feed Health Monitor Service
 * 
 * ตรวจสอบสถานะ DataFeeder EA ว่ายังส่งข้อมูลอยู่หรือไม่
 * ถ้าไม่ได้รับข้อมูลเกิน threshold → แจ้งเตือนผู้ดูแลระบบทาง LINE/Telegram
 * 
 * Created: 2026-04-11
 */

const LineNotify = require('./lineNotify');
const TelegramNotify = require('./telegramNotify');
const { pool } = require('../config/database');

class FeedHealthMonitor {
  constructor() {
    this.lastFeedTime = null;           // เวลาที่ได้รับข้อมูลล่าสุด
    this.lastFeedRecords = 0;           // จำนวน records ล่าสุดที่ได้รับ
    this.lastFeedSymbols = [];          // symbols ที่ได้รับล่าสุด
    this.isAlerted = false;             // สถานะว่าแจ้งเตือนไปแล้วหรือยัง (ป้องกัน spam)
    this.alertCooldownMs = 5 * 60 * 1000;  // ระยะเวลา cooldown 5 นาที
    this.lastAlertTime = null;          // เวลาที่แจ้งเตือนครั้งล่าสุด
    this.consecutiveFailures = 0;       // นับจำนวนครั้งที่เช็คแล้วไม่มีข้อมูล
    this.totalFeedCount = 0;            // จำนวนครั้งที่ได้รับข้อมูลทั้งหมด
    this.startTime = new Date();        // เวลาที่เริ่มทำงาน

    // Config
    this.THRESHOLD_SECONDS = parseInt(process.env.FEED_HEALTH_THRESHOLD || '60');  // วินาที
    this.CHECK_INTERVAL_MS = parseInt(process.env.FEED_HEALTH_CHECK_INTERVAL || '30000'); // 30 วินาที
    this.ADMIN_USER_ID = parseInt(process.env.FEED_HEALTH_ADMIN_USER_ID || '1');  // Admin user ID

    this._intervalId = null;
  }

  /**
   * เริ่มต้น Health Monitor
   */
  start() {
    console.log(`[HealthMonitor] 🏥 Started. Threshold: ${this.THRESHOLD_SECONDS}s, Check every: ${this.CHECK_INTERVAL_MS / 1000}s`);
    
    this._intervalId = setInterval(() => {
      this.check();
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * หยุด Health Monitor
   */
  stop() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
      console.log('[HealthMonitor] Stopped.');
    }
  }

  /**
   * บันทึกว่าได้รับข้อมูลจาก DataFeeder
   * เรียกทุกครั้งที่ /api/bridge/feed ได้รับข้อมูลสำเร็จ
   */
  recordFeed(recordCount, symbols = []) {
    this.lastFeedTime = new Date();
    this.lastFeedRecords = recordCount;
    this.lastFeedSymbols = symbols;
    this.totalFeedCount++;
    this.consecutiveFailures = 0;

    // ถ้าเคยแจ้งเตือนไปแล้ว → แจ้งว่ากลับมาปกติ
    if (this.isAlerted) {
      this.isAlerted = false;
      this.sendRecoveryAlert();
    }
  }

  /**
   * ตรวจสอบสถานะ DataFeeder
   */
  async check() {
    // ถ้ายังไม่เคยได้รับข้อมูลเลย (เพิ่งเริ่ม)
    if (!this.lastFeedTime) {
      const uptime = (new Date() - this.startTime) / 1000;
      // รอ 2 นาทีหลัง startup ก่อน alert (ให้ EA เวลา boot)
      if (uptime > 120) {
        this.consecutiveFailures++;
        if (!this.isAlerted) {
          await this.sendDownAlert('ไม่เคยได้รับข้อมูลจาก DataFeeder ตั้งแต่เปิดระบบ');
        }
      }
      return;
    }

    const now = new Date();
    const elapsedSeconds = (now - this.lastFeedTime) / 1000;

    if (elapsedSeconds > this.THRESHOLD_SECONDS) {
      this.consecutiveFailures++;
      
      // แจ้งเตือนครั้งแรก หรือ ทุก 5 นาที
      if (!this.isAlerted || this.canAlertAgain()) {
        await this.sendDownAlert(
          `ไม่ได้รับข้อมูลจาก DataFeeder มา ${Math.floor(elapsedSeconds)} วินาที`
        );
      }
    }
  }

  /**
   * ตรวจสอบว่าสามารถ alert ซ้ำได้หรือยัง (cooldown)
   */
  canAlertAgain() {
    if (!this.lastAlertTime) return true;
    return (new Date() - this.lastAlertTime) > this.alertCooldownMs;
  }

  /**
   * ส่งแจ้งเตือนว่า DataFeeder หยุดทำงาน
   */
  async sendDownAlert(reason) {
    this.isAlerted = true;
    this.lastAlertTime = new Date();

    const message = [
      `🚨 DataFeeder Alert!`,
      `สถานะ: ❌ ไม่ทำงาน`,
      `${reason}`,
      `Last Feed: ${this.lastFeedTime ? this.lastFeedTime.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : 'Never'}`,
      `Records ล่าสุด: ${this.lastFeedRecords}`,
      `Failures ติดต่อกัน: ${this.consecutiveFailures}`,
      `กรุณาตรวจสอบ MT5 บน INET Server`
    ].join('\n');

    console.error(`[HealthMonitor] 🚨 ALERT: ${reason}`);

    try {
      await Promise.all([
        LineNotify.sendAlert(this.ADMIN_USER_ID, message),
        TelegramNotify.sendAlert(this.ADMIN_USER_ID, message)
      ]);
    } catch (err) {
      console.error('[HealthMonitor] Failed to send alert:', err.message);
    }
  }

  /**
   * ส่งแจ้งเตือนว่า DataFeeder กลับมาทำงานปกติ
   */
  async sendRecoveryAlert() {
    const message = [
      `✅ DataFeeder กลับมาปกติ!`,
      `สถานะ: ✅ Active`,
      `เวลา: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`,
      `Records: ${this.lastFeedRecords}`,
      `ระบบดำเนินการต่อตามปกติ`
    ].join('\n');

    console.log('[HealthMonitor] ✅ DataFeeder recovered.');

    try {
      await Promise.all([
        LineNotify.sendAlert(this.ADMIN_USER_ID, message),
        TelegramNotify.sendAlert(this.ADMIN_USER_ID, message)
      ]);
    } catch (err) {
      console.error('[HealthMonitor] Failed to send recovery alert:', err.message);
    }
  }

  /**
   * ดึงสถานะ Health Monitor (สำหรับ API endpoint)
   */
  getStatus() {
    const now = new Date();
    const elapsedSeconds = this.lastFeedTime ? Math.floor((now - this.lastFeedTime) / 1000) : null;
    const isHealthy = this.lastFeedTime && elapsedSeconds <= this.THRESHOLD_SECONDS;

    return {
      status: isHealthy ? 'healthy' : (this.lastFeedTime ? 'unhealthy' : 'waiting'),
      is_healthy: isHealthy,
      last_feed_time: this.lastFeedTime,
      last_feed_ago_seconds: elapsedSeconds,
      last_feed_records: this.lastFeedRecords,
      last_feed_symbols: this.lastFeedSymbols,
      total_feed_count: this.totalFeedCount,
      consecutive_failures: this.consecutiveFailures,
      is_alerted: this.isAlerted,
      threshold_seconds: this.THRESHOLD_SECONDS,
      uptime_seconds: Math.floor((now - this.startTime) / 1000)
    };
  }
}

// Singleton instance
const monitor = new FeedHealthMonitor();

module.exports = monitor;
