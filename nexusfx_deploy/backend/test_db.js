require('dotenv').config();
const { pool } = require('./config/database');

async function test() {
  try {
    const reqBody = {
      theme_id: 'royal-purple',
      custom_colors: null,
      dashboard_layout: null,
      notifications_enabled: true,
      sound_enabled: true,
      language: 'th',
      timezone: 'Asia/Bangkok',
      notify_new_trade: false,
      metaapi_token: 'yesitis',
      auto_sync: false
    };

    const result = await pool.query(`
      INSERT INTO user_settings (user_id, theme_id, custom_colors, dashboard_layout, notifications_enabled, sound_enabled, language, timezone, notify_new_trade, metaapi_token, auto_sync)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (user_id) DO UPDATE SET
        theme_id = COALESCE($2, user_settings.theme_id),
        custom_colors = COALESCE($3, user_settings.custom_colors),
        dashboard_layout = COALESCE($4, user_settings.dashboard_layout),
        notifications_enabled = COALESCE($5, user_settings.notifications_enabled),
        sound_enabled = COALESCE($6, user_settings.sound_enabled),
        language = COALESCE($7, user_settings.language),
        timezone = COALESCE($8, user_settings.timezone),
        notify_new_trade = COALESCE($9, user_settings.notify_new_trade),
        metaapi_token = COALESCE($10, user_settings.metaapi_token),
        auto_sync = COALESCE($11, user_settings.auto_sync),
        updated_at = NOW()
      RETURNING *
    `, [
      2, reqBody.theme_id, reqBody.custom_colors, reqBody.dashboard_layout,
      reqBody.notifications_enabled, reqBody.sound_enabled, reqBody.language,
      reqBody.timezone, reqBody.notify_new_trade, reqBody.metaapi_token, reqBody.auto_sync
    ]);

    console.log('Successfully updated:', result.rows[0]);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit();
  }
}

test();
