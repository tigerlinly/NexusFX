const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('❌ Unexpected DB error:', err);
  process.exit(-1);
});

// Initialize database schema
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // =============================================
    // ROLES & PERMISSIONS (RBAC)
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        role_name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        is_system_default BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        module_name VARCHAR(50) NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
      );
    `);

    // =============================================
    // USERS (enhanced with role)
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(100),
        avatar_url TEXT,
        role_id INTEGER REFERENCES roles(id),
        theme_id VARCHAR(50) DEFAULT 'dark-trading',
        is_active BOOLEAN DEFAULT true,
        mfa_secret VARCHAR(255),
        mfa_enabled BOOLEAN DEFAULT false,
        reset_token VARCHAR(255),
        reset_token_expires TIMESTAMPTZ,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Add columns if missing (for existing tables)
    try {
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id);`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(255);`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false;`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS current_plan_id INTEGER REFERENCES membership_plans(id);`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;`);
    } catch (e) { /* ignore */ }

    // =============================================
    // BROKERS REGISTRY
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS brokers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        display_name VARCHAR(100),
        market_type VARCHAR(50) DEFAULT 'Forex',
        protocol VARCHAR(20) DEFAULT 'MT5',
        adapter_config JSONB DEFAULT '{}',
        logo_url TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    try {
      await client.query(`ALTER TABLE brokers ADD COLUMN IF NOT EXISTS market_type VARCHAR(50) DEFAULT 'Forex';`);
      await client.query(`ALTER TABLE brokers ADD COLUMN IF NOT EXISTS adapter_config JSONB DEFAULT '{}';`);
      await client.query(`ALTER TABLE brokers ADD COLUMN IF NOT EXISTS regulation VARCHAR(255);`);
      await client.query(`ALTER TABLE brokers ADD COLUMN IF NOT EXISTS country VARCHAR(100);`);
      await client.query(`ALTER TABLE brokers ADD COLUMN IF NOT EXISTS website VARCHAR(255);`);
      await client.query(`ALTER TABLE brokers ADD COLUMN IF NOT EXISTS max_leverage VARCHAR(20);`);
      await client.query(`ALTER TABLE brokers ADD COLUMN IF NOT EXISTS min_deposit DECIMAL(18,2);`);
      await client.query(`ALTER TABLE brokers ADD COLUMN IF NOT EXISTS description TEXT;`);
      await client.query(`ALTER TABLE brokers ADD COLUMN IF NOT EXISTS rating DECIMAL(3,1) DEFAULT 0;`);
      await client.query(`ALTER TABLE brokers ADD COLUMN IF NOT EXISTS spread_from VARCHAR(50);`);
      await client.query(`ALTER TABLE brokers ADD COLUMN IF NOT EXISTS platforms VARCHAR(255);`);
    } catch (e) { /* ignore */ }

    // =============================================
    // ACCOUNTS (User -> Broker -> Account)
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        broker_id INTEGER NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
        account_number VARCHAR(50) NOT NULL,
        account_name VARCHAR(100),
        account_type VARCHAR(20) DEFAULT 'Real',
        currency VARCHAR(10) DEFAULT 'USD',
        balance DECIMAL(18,2) DEFAULT 0,
        equity DECIMAL(18,2) DEFAULT 0,
        leverage INTEGER DEFAULT 100,
        server VARCHAR(100),
        metaapi_account_id VARCHAR(100),
        is_connected BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        last_sync_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, broker_id, account_number)
      );
    `);

    // =============================================
    // GROUPS & TEAM MANAGEMENT
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        group_name VARCHAR(100) NOT NULL,
        description TEXT,
        lead_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        config JSONB DEFAULT '{}',
        max_members INTEGER DEFAULT 50,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS group_members (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(group_id, user_id)
      );
    `);

    // =============================================
    // WALLETS & FINANCIAL TRANSACTIONS
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        currency VARCHAR(10) DEFAULT 'USD',
        balance DECIMAL(18,2) DEFAULT 0,
        locked_balance DECIMAL(18,2) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, currency)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS financial_transactions (
        id SERIAL PRIMARY KEY,
        wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL,
        amount DECIMAL(18,2) NOT NULL,
        fee DECIMAL(18,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'PENDING',
        reference_id VARCHAR(100),
        tx_hash VARCHAR(255),
        note TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );
    `);

    // =============================================
    // BROKER CONNECTIONS (Encrypted credentials)
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS broker_connections (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        broker_id INTEGER NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
        auth_payload TEXT,
        connection_status VARCHAR(20) DEFAULT 'DISCONNECTED',
        last_connected_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, broker_id)
      );
    `);

    // =============================================
    // TRADES
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS trades (
        id SERIAL PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        bot_id INTEGER,
        ticket VARCHAR(50),
        symbol VARCHAR(20) NOT NULL,
        side VARCHAR(10) NOT NULL,
        lot_size DECIMAL(10,4) NOT NULL,
        entry_price DECIMAL(18,6),
        exit_price DECIMAL(18,6),
        stop_loss DECIMAL(18,6),
        take_profit DECIMAL(18,6),
        pnl DECIMAL(18,2),
        commission DECIMAL(18,2) DEFAULT 0,
        swap DECIMAL(18,2) DEFAULT 0,
        opened_at TIMESTAMPTZ,
        closed_at TIMESTAMPTZ,
        status VARCHAR(20) DEFAULT 'OPEN',
        magic_number INTEGER,
        comment TEXT,
        current_price DECIMAL(18,6),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(account_id, ticket)
      );
    `);

    // =============================================
    // ORDERS (Normalized order records)
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        exchange_order_id VARCHAR(100),
        symbol VARCHAR(20) NOT NULL,
        side VARCHAR(10) NOT NULL,
        order_type VARCHAR(20) DEFAULT 'MARKET',
        price DECIMAL(18,6),
        quantity DECIMAL(18,6),
        filled_quantity DECIMAL(18,6) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'PENDING',
        filled_at TIMESTAMPTZ,
        cancelled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // =============================================
    // SERVICE FEE LOGS
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS service_fee_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        trade_id INTEGER REFERENCES trades(id) ON DELETE SET NULL,
        fee_type VARCHAR(30) NOT NULL,
        amount DECIMAL(18,2) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'PENDING',
        settled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // =============================================
    // TRADING BOTS
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS trading_bots (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_id INTEGER REFERENCES accounts(id),
        group_id INTEGER REFERENCES groups(id),
        bot_name VARCHAR(100) NOT NULL,
        strategy_type VARCHAR(50) DEFAULT 'Custom',
        parameters JSONB DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'STOPPED',
        is_active BOOLEAN DEFAULT true,
        last_run_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // bot_events table is created below (after dashboard_widgets)

    // =============================================
    // DAILY TARGETS
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_targets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_id INTEGER,
        target_amount DECIMAL(18,2) NOT NULL,
        action_on_reach VARCHAR(20) DEFAULT 'NOTIFY',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // =============================================
    // DAILY AGGREGATES
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_aggregates (
        id SERIAL PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        report_date DATE NOT NULL,
        total_pnl DECIMAL(18,2) DEFAULT 0,
        total_trades INTEGER DEFAULT 0,
        winning_trades INTEGER DEFAULT 0,
        losing_trades INTEGER DEFAULT 0,
        win_rate DECIMAL(5,2) DEFAULT 0,
        total_volume DECIMAL(18,4) DEFAULT 0,
        max_drawdown DECIMAL(18,2) DEFAULT 0,
        best_trade DECIMAL(18,2) DEFAULT 0,
        worst_trade DECIMAL(18,2) DEFAULT 0,
        target_reached BOOLEAN DEFAULT false,
        target_reached_at TIMESTAMPTZ,
        continued_after_target BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(account_id, report_date)
      );
    `);

    // =============================================
    // WEEKLY AGGREGATES
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_aggregates (
        id SERIAL PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        entity_type VARCHAR(20) DEFAULT 'ACCOUNT',
        week_number INTEGER NOT NULL,
        year INTEGER NOT NULL,
        total_pnl DECIMAL(18,2) DEFAULT 0,
        net_pnl DECIMAL(18,2) DEFAULT 0,
        growth_pct DECIMAL(8,4) DEFAULT 0,
        total_trades INTEGER DEFAULT 0,
        win_rate DECIMAL(5,2) DEFAULT 0,
        total_volume DECIMAL(18,4) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(account_id, week_number, year)
      );
    `);

    // =============================================
    // MONTHLY AGGREGATES
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS monthly_aggregates (
        id SERIAL PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        entity_type VARCHAR(20) DEFAULT 'ACCOUNT',
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        total_pnl DECIMAL(18,2) DEFAULT 0,
        net_pnl DECIMAL(18,2) DEFAULT 0,
        total_fees DECIMAL(18,2) DEFAULT 0,
        drawdown_max DECIMAL(18,2) DEFAULT 0,
        growth_pct DECIMAL(8,4) DEFAULT 0,
        total_trades INTEGER DEFAULT 0,
        win_rate DECIMAL(5,2) DEFAULT 0,
        total_volume DECIMAL(18,4) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(account_id, month, year)
      );
    `);

    // =============================================
    // TARGET HISTORY
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS target_history (
        id SERIAL PRIMARY KEY,
        daily_target_id INTEGER NOT NULL REFERENCES daily_targets(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_id INTEGER,
        reached_date DATE NOT NULL,
        target_amount DECIMAL(18,2) NOT NULL,
        pnl_at_reach DECIMAL(18,2) NOT NULL,
        user_action VARCHAR(20),
        final_pnl DECIMAL(18,2),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // =============================================
    // USER SETTINGS
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        theme_id VARCHAR(50) DEFAULT 'dark-trading',
        custom_colors JSONB DEFAULT '{}',
        dashboard_layout JSONB DEFAULT '{}',
        notifications_enabled BOOLEAN DEFAULT true,
        sound_enabled BOOLEAN DEFAULT true,
        language VARCHAR(10) DEFAULT 'th',
        timezone VARCHAR(50) DEFAULT 'Asia/Bangkok',
        notify_new_trade BOOLEAN DEFAULT false,
        metaapi_token TEXT,
        auto_sync BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Ensure new columns exist in case the table was created previously
    try {
      await client.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notify_new_trade BOOLEAN DEFAULT false;`);
      await client.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS metaapi_token TEXT;`);
      await client.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS auto_sync BOOLEAN DEFAULT true;`);
      
      // New Token APIs
      await client.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS binance_api_key TEXT;`);
      await client.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS binance_api_secret TEXT;`);
      await client.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS twelvedata_api_key TEXT;`);
      await client.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS line_notify_token TEXT;`);
      await client.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT;`);
      await client.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;`);

      // Ensure existing columns are wide enough (upgrade from VARCHAR(255) to TEXT)
      await client.query(`ALTER TABLE user_settings ALTER COLUMN metaapi_token TYPE TEXT;`);
      await client.query(`ALTER TABLE user_settings ALTER COLUMN binance_api_key TYPE TEXT;`);
      await client.query(`ALTER TABLE user_settings ALTER COLUMN binance_api_secret TYPE TEXT;`);
      await client.query(`ALTER TABLE user_settings ALTER COLUMN line_notify_token TYPE TEXT;`);
      await client.query(`ALTER TABLE user_settings ALTER COLUMN telegram_bot_token TYPE TEXT;`);
      await client.query(`ALTER TABLE user_settings ALTER COLUMN telegram_chat_id TYPE TEXT;`);
    } catch (e) { /* ignore */ }

    // =============================================

    // =============================================
    // REPORT EXPORTS
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS report_exports (
        id SERIAL PRIMARY KEY,
        requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        report_type VARCHAR(30) NOT NULL,
        format VARCHAR(10) DEFAULT 'CSV',
        params JSONB DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'PENDING',
        file_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );
    `);

    // =============================================
    // AUDIT LOGS
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50),
        entity_id INTEGER,
        details JSONB DEFAULT '{}',
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // =============================================
    // DASHBOARD WIDGETS
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS dashboard_widgets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        widget_type VARCHAR(50) NOT NULL,
        position_x INTEGER DEFAULT 0,
        position_y INTEGER DEFAULT 0,
        width INTEGER DEFAULT 2,
        height INTEGER DEFAULT 2,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // =============================================
    // BOT EVENTS (unified definition)
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS bot_events (
        id SERIAL PRIMARY KEY,
        bot_id INTEGER REFERENCES trading_bots(id) ON DELETE SET NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        event_type VARCHAR(50) NOT NULL,
        message TEXT,
        payload JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Ensure bot_events has all columns for existing databases
    try {
      await client.query(`ALTER TABLE bot_events ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;`);
      await client.query(`ALTER TABLE bot_events ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}';`);
    } catch (e) { /* ignore */ }

    // =============================================
    // WITHDRAWALS
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        amount DECIMAL(18,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        method VARCHAR(50),
        status VARCHAR(20) DEFAULT 'COMPLETED',
        reference_id VARCHAR(100),
        note TEXT,
        withdrawn_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // =============================================
    // MEMBERSHIP PLANS (Level 2 — DB-driven billing)
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS membership_plans (
        id SERIAL PRIMARY KEY,
        plan_key VARCHAR(50) UNIQUE NOT NULL,
        plan_name VARCHAR(100) NOT NULL,
        description TEXT,
        monthly_price DECIMAL(18,2) NOT NULL DEFAULT 0,
        max_bots INTEGER DEFAULT 2,
        max_accounts INTEGER DEFAULT 3,
        features JSONB DEFAULT '[]',
        is_popular BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // =============================================
    // SUBSCRIPTION HISTORY
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscription_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_id INTEGER NOT NULL REFERENCES membership_plans(id),
        amount DECIMAL(18,2) NOT NULL,
        payment_status VARCHAR(20) DEFAULT 'COMPLETED',
        payment_method VARCHAR(50) DEFAULT 'WALLET',
        period_start TIMESTAMPTZ DEFAULT NOW(),
        period_end TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // =============================================
    // SYSTEM CONFIGURATION
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    // Insert defaults if not exists
    await client.query(`
      INSERT INTO system_config (key, value, description)
      VALUES 
        ('STRIPE_SECRET_KEY', '', 'Stripe API Secret Key (สำหรับการรับชำระเงิน)'),
        ('CRYPTO_WALLET_ADDRESS', '', 'ที่อยู่กระเป๋าเงินคริปโต (TRC20 USD หรือ USDT)'),
        ('BANK_ACCOUNT_INFO', '', 'ข้อมูลบัญชีธนาคาร (เช่น ธ.กสิกรไทย 123-4-56789-0)')
      ON CONFLICT (key) DO NOTHING;
    `);

    // =============================================
    // PROFIT SHARING LOGS (Level 2 — Profit Sharing Calculator)
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS profit_sharing_logs (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        leader_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        member_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        member_pnl DECIMAL(18,2) NOT NULL DEFAULT 0,
        share_percentage DECIMAL(5,2) NOT NULL DEFAULT 20,
        leader_share DECIMAL(18,2) NOT NULL DEFAULT 0,
        member_net DECIMAL(18,2) NOT NULL DEFAULT 0,
        status VARCHAR(20) DEFAULT 'CALCULATED',
        settled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Seed default membership plans
    await client.query(`
      INSERT INTO membership_plans (plan_key, plan_name, description, monthly_price, max_bots, max_accounts, features, is_popular, sort_order)
      VALUES 
        ('free', 'Free Trial', 'สำหรับทดลองใช้งาน 15 วัน', 0, 1, 1, 
         '["รันบอทสูงสุด 1 ตัว", "ระยะเวลาใช้งาน 15 วัน", "อัปเดตราคาแบบ Real-time", "อีเมลแจ้งเตือนเมื่อออเดอร์เข้า", "ประวัติย้อนหลัง 30 วัน"]', 
         false, 0),
        ('basic', 'Starter Trader', 'เหมาะสำหรับเทรดเดอร์มือใหม่', 29, 2, 3, 
         '["รันบอทสูงสุด 2 ตัว", "อัปเดตราคาแบบ Real-time", "อีเมลแจ้งเตือนเมื่อออเดอร์เข้า", "ประวัติย้อนหลัง 30 วัน"]', 
         false, 1),
        ('pro', 'Pro Algo', 'สำหรับเทรดเดอร์มืออาชีพ', 99, 10, 10,
         '["รันบอทสูงสุด 10 ตัว", "รวมฟีเจอร์ Starter Trader", "ดึงสัญญาณ TradingView Webhook", "Line Notify เรียลไทม์", "ประวัติเข้าใช้งานไม่จำกัด (Archive)"]',
         true, 2),
        ('enterprise', 'White-label / B2B', 'สำหรับองค์กรและพาร์ทเนอร์', 199, -1, -1,
         '["รันบอทไม่จำกัด", "ตั้งค่าทีมและหัวหน้างาน (RBAC)", "เชื่อม API Key หลายพอร์ต", "ปรับแต่งสีธีม-โลโก้ของตัวเอง", "ทีมซัพพอร์ตระดับ Priority"]',
         false, 3)
      ON CONFLICT (plan_key) DO NOTHING;
    `);

    // =============================================
    // COPY TRADING — Strategies
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS strategies (
        id SERIAL PRIMARY KEY,
        publisher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        category VARCHAR(50) DEFAULT 'manual',
        tags TEXT[] DEFAULT '{}',
        symbols TEXT[] DEFAULT '{}',
        risk_level VARCHAR(20) DEFAULT 'medium',
        monthly_return DECIMAL(10,2) DEFAULT 0,
        win_rate DECIMAL(5,2) DEFAULT 0,
        total_trades INTEGER DEFAULT 0,
        subscribers_count INTEGER DEFAULT 0,
        price_monthly DECIMAL(10,2) DEFAULT 0,
        is_free BOOLEAN DEFAULT true,
        is_published BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // =============================================
    // COPY TRADING — Subscriptions
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS strategy_subscriptions (
        id SERIAL PRIMARY KEY,
        strategy_id INTEGER NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
        subscriber_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_id INTEGER REFERENCES accounts(id),
        lot_multiplier DECIMAL(5,2) DEFAULT 1.0,
        max_lot DECIMAL(10,2) DEFAULT 10,
        is_active BOOLEAN DEFAULT true,
        subscribed_at TIMESTAMPTZ DEFAULT NOW(),
        unsubscribed_at TIMESTAMPTZ,
        UNIQUE(strategy_id, subscriber_id)
      );
    `);

    // =============================================
    // COPY TRADING — Signal History
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS strategy_signals (
        id SERIAL PRIMARY KEY,
        strategy_id INTEGER NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
        publisher_trade_id INTEGER REFERENCES trades(id),
        symbol VARCHAR(20) NOT NULL,
        side VARCHAR(10) NOT NULL,
        lot_size DECIMAL(10,2),
        entry_price DECIMAL(18,6),
        sl DECIMAL(18,6),
        tp DECIMAL(18,6),
        signal_type VARCHAR(20) DEFAULT 'OPEN',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // =============================================
    // TRADE PSYCHOLOGY — Analysis Reports
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS trade_psychology_reports (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        report_date DATE NOT NULL DEFAULT CURRENT_DATE,
        period_days INTEGER DEFAULT 30,
        overall_score DECIMAL(5,2) DEFAULT 0,
        patterns JSONB DEFAULT '[]',
        recommendations JSONB DEFAULT '[]',
        metrics JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, report_date, period_days)
      );
    `);

    // =============================================
    // INDEXES
    // =============================================
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
      CREATE INDEX IF NOT EXISTS idx_accounts_broker_id ON accounts(broker_id);
      CREATE INDEX IF NOT EXISTS idx_trades_account_id ON trades(account_id);
      CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
      CREATE INDEX IF NOT EXISTS idx_trades_closed_at ON trades(closed_at);
      CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
      CREATE INDEX IF NOT EXISTS idx_daily_aggregates_account_date ON daily_aggregates(account_id, report_date);
      CREATE INDEX IF NOT EXISTS idx_daily_targets_user_id ON daily_targets(user_id);
      CREATE INDEX IF NOT EXISTS idx_target_history_user_id ON target_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_withdrawals_account_id ON withdrawals(account_id);
      CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
      CREATE INDEX IF NOT EXISTS idx_groups_lead ON groups(lead_user_id);
      CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
      CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
      CREATE INDEX IF NOT EXISTS idx_financial_transactions_wallet ON financial_transactions(wallet_id);
      CREATE INDEX IF NOT EXISTS idx_financial_transactions_user ON financial_transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_account ON orders(account_id);
      CREATE INDEX IF NOT EXISTS idx_service_fees_user ON service_fee_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_bot_events_bot ON bot_events(bot_id);
      CREATE INDEX IF NOT EXISTS idx_weekly_agg ON weekly_aggregates(account_id, year, week_number);
      CREATE INDEX IF NOT EXISTS idx_monthly_agg ON monthly_aggregates(account_id, year, month);
      CREATE INDEX IF NOT EXISTS idx_report_exports_user ON report_exports(requested_by);
    `);

    // =============================================
    // SEED DEFAULT ROLES & PERMISSIONS
    // =============================================
    await client.query(`
      INSERT INTO roles (role_name, description, is_system_default) VALUES
        ('admin', 'System Administrator with full access', true),
        ('team_lead', 'Team leader who manages a group of traders', true),
        ('user', 'Regular trader', true)
      ON CONFLICT (role_name) DO NOTHING;
    `);

    await client.query(`
      INSERT INTO permissions (slug, module_name, description) VALUES
        ('dashboard.view', 'dashboard', 'View dashboard'),
        ('trade.view', 'trade', 'View trades'),
        ('trade.execute', 'trade', 'Execute trades'),
        ('account.manage', 'account', 'Manage trading accounts'),
        ('finance.deposit', 'finance', 'Make deposits'),
        ('finance.withdraw', 'finance', 'Make withdrawals'),
        ('finance.view', 'finance', 'View financial transactions'),
        ('group.create', 'group', 'Create groups'),
        ('group.manage', 'group', 'Manage group members'),
        ('group.view_team', 'group', 'View team performance'),
        ('report.view', 'report', 'View reports'),
        ('report.export', 'report', 'Export reports'),
        ('settings.manage', 'settings', 'Manage settings'),
        ('admin.users', 'admin', 'Manage all users'),
        ('admin.system', 'admin', 'System administration'),
        ('admin.audit', 'admin', 'View audit logs'),
        ('admin.revenue', 'admin', 'View revenue data'),
        ('bot.manage', 'bot', 'Manage trading bots'),
        ('bot.view', 'bot', 'View bot status')
      ON CONFLICT (slug) DO NOTHING;
    `);

    // Assign permissions to roles
    // Admin gets all permissions
    await client.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r, permissions p WHERE r.role_name = 'admin'
      ON CONFLICT DO NOTHING;
    `);

    // Team Lead gets trading + group + finance + report permissions
    await client.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r, permissions p
      WHERE r.role_name = 'team_lead'
        AND p.slug IN ('dashboard.view','trade.view','trade.execute','account.manage',
                       'finance.deposit','finance.withdraw','finance.view',
                       'group.create','group.manage','group.view_team',
                       'report.view','report.export','settings.manage','bot.manage','bot.view')
      ON CONFLICT DO NOTHING;
    `);

    // User gets basic permissions
    await client.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r, permissions p
      WHERE r.role_name = 'user'
        AND p.slug IN ('dashboard.view','trade.view','trade.execute','account.manage',
                       'finance.deposit','finance.withdraw','finance.view',
                       'report.view','settings.manage','bot.view')
      ON CONFLICT DO NOTHING;
    `);

    // Set default role for existing users without a role
    await client.query(`
      UPDATE users SET role_id = (SELECT id FROM roles WHERE role_name = 'user')
      WHERE role_id IS NULL;
    `);

    // =============================================
    // SOCIAL TRADING / FORUMS (Phase 4)
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS forums (
        id SERIAL PRIMARY KEY,
        author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'general',
        views INTEGER DEFAULT 0,
        is_pinned BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS forum_comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES forums(id) ON DELETE CASCADE,
        author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS forum_likes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES forums(id) ON DELETE CASCADE,
        comment_id INTEGER REFERENCES forum_comments(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CHECK (
          (post_id IS NOT NULL AND comment_id IS NULL) OR
          (post_id IS NULL AND comment_id IS NOT NULL)
        ),
        UNIQUE(user_id, post_id),
        UNIQUE(user_id, comment_id)
      );
    `);

    await client.query('COMMIT');

    // Safe to run outside transaction:
    try {
      await client.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS current_price DECIMAL(18,6);`);
      await client.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS bot_id INTEGER;`);
      await client.query(`ALTER TABLE trades ADD CONSTRAINT unique_account_ticket UNIQUE (account_id, ticket);`);
    } catch (e) { /* ignore constraint errors if already exists */ }

    // Notifications table (in-app notifications)
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL DEFAULT 'info',
          title VARCHAR(255) NOT NULL,
          message TEXT,
          data JSONB DEFAULT '{}',
          is_read BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
      `);
    } catch (e) { /* ignore if exists */ }

    console.log('✅ Database schema initialized successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error initializing database:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, initDatabase };
