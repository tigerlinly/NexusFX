const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Datacenter Pool — สำหรับเก็บข้อมูลราคา (market_candles)
const datacenterPool = new Pool({
  connectionString: process.env.DATACENTER_DATABASE_URL || process.env.DATABASE_URL,
  max: 50,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('❌ Unexpected DB error:', err);
  process.exit(-1);
});

datacenterPool.on('error', (err) => {
  console.error('❌ Unexpected Datacenter DB error:', err);
});

// Initialize database schema
async function initDatabase() {
  const client = await pool.connect();
  try {

    // =============================================
    // TENANTS (B2B / White-label)
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        domain VARCHAR(100) UNIQUE,
        logo_url TEXT,
        primary_color VARCHAR(20) DEFAULT '#007bff',
        secondary_color VARCHAR(20) DEFAULT '#6c757d',
        platform_name VARCHAR(100) DEFAULT 'NexusFX',
        owner_user_id INTEGER,
        revenue_share_pct DECIMAL(5,2) DEFAULT 10.00,
        max_users INTEGER DEFAULT 50,
        subscription_plan VARCHAR(50) DEFAULT 'enterprise',
        is_active BOOLEAN DEFAULT true,
        contact_email VARCHAR(255),
        contact_phone VARCHAR(50),
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Add new columns for existing tenants table
    try {
      await client.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_user_id INTEGER;`);
      await client.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS revenue_share_pct DECIMAL(5,2) DEFAULT 10.00;`);
      await client.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 50;`);
      await client.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'enterprise';`);
      await client.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(20) DEFAULT '#6c757d';`);
      await client.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS platform_name VARCHAR(100) DEFAULT 'NexusFX';`);
      await client.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);`);
    } catch (e) { /* ignore */ }

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
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
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
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL;`);
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
        connection_type VARCHAR(50) DEFAULT 'TYPE_1_EA',
        bridge_token VARCHAR(255),
        is_connected BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        is_master BOOLEAN DEFAULT false,
        copy_target_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
        api_credentials JSONB DEFAULT '{}',
        last_sync_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Standard 1: Partial Unique Index to allow duplicate account_numbers if they are soft-deleted
    try {
      await client.query(`ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_id_broker_id_account_number_key;`);
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_unique_active_account ON accounts (user_id, broker_id, account_number) WHERE is_active = true;`);
    } catch (e) { console.error('Migration error index:', e); }

    // Add missing columns for existing accounts table
    try {
      await client.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS connection_type VARCHAR(50) DEFAULT 'TYPE_3_METAAPI';`);
      await client.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS bridge_token VARCHAR(255);`);
      await client.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_master BOOLEAN DEFAULT false;`);
      await client.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS copy_target_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL;`);
      await client.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS api_credentials JSONB DEFAULT '{}';`);
    } catch (e) { console.error('Migration error accounts:', e); }

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
      CREATE TABLE IF NOT EXISTS balance_adjustments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        requested_by INTEGER NOT NULL REFERENCES users(id),
        approved_by INTEGER REFERENCES users(id),
        amount DECIMAL(18,2) NOT NULL,
        reason TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'PENDING',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
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
        primary_timeframe VARCHAR(10) DEFAULT '5m',
        analysis_timeframes JSONB DEFAULT '["5m", "15m"]'::jsonb,
        indicators_config JSONB DEFAULT '[]'::jsonb,
        min_confidence INTEGER DEFAULT 60,
        parameters JSONB DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'STOPPED',
        is_active BOOLEAN DEFAULT true,
        last_run_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Add missing columns for existing bots (backward-compat migration)
    try {
      await client.query(`ALTER TABLE trading_bots ADD COLUMN IF NOT EXISTS primary_timeframe VARCHAR(10) DEFAULT '5m';`);
      await client.query(`ALTER TABLE trading_bots ADD COLUMN IF NOT EXISTS analysis_timeframes JSONB DEFAULT '["5m", "15m"]'::jsonb;`);
      await client.query(`ALTER TABLE trading_bots ADD COLUMN IF NOT EXISTS indicators_config JSONB DEFAULT '[]'::jsonb;`);
      await client.query(`ALTER TABLE trading_bots ADD COLUMN IF NOT EXISTS min_confidence INTEGER DEFAULT 60;`);
    } catch (e) { /* ignore */ }

    // =============================================
    // ORDERS (Normalized order records)
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        bot_id INTEGER REFERENCES trading_bots(id) ON DELETE SET NULL,
        exchange_order_id VARCHAR(100),
        symbol VARCHAR(20) NOT NULL,
        side VARCHAR(10) NOT NULL,
        order_type VARCHAR(20) DEFAULT 'MARKET',
        type VARCHAR(20),
        price DECIMAL(18,6),
        quantity DECIMAL(18,6),
        filled_quantity DECIMAL(18,6) DEFAULT 0,
        entry_price DECIMAL(18,6),
        stop_loss DECIMAL(18,6),
        take_profit DECIMAL(18,6),
        current_sl DECIMAL(18,6),
        current_tp DECIMAL(18,6),
        pip_size DECIMAL(12,6) DEFAULT 0.0001,
        trailing_stop_enabled BOOLEAN DEFAULT false,
        trailing_distance_pips DECIMAL(10,2),
        trail_trigger_pips DECIMAL(10,2),
        breakeven_trigger_pips DECIMAL(10,2),
        breakeven_triggered BOOLEAN DEFAULT false,
        peak_price DECIMAL(18,6),
        trailing_log JSONB DEFAULT '[]'::jsonb,
        sl_pips DECIMAL(10,2),
        tp_pips DECIMAL(10,2),
        risk_reward VARCHAR(20),
        status VARCHAR(20) DEFAULT 'PENDING',
        error_message TEXT,
        filled_at TIMESTAMPTZ,
        cancelled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Add missing columns for existing orders table (backward-compat migration)
    try {
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;`);
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS bot_id INTEGER REFERENCES trading_bots(id) ON DELETE SET NULL;`);
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS entry_price DECIMAL(18,6);`);
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS stop_loss DECIMAL(18,6);`);
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS take_profit DECIMAL(18,6);`);
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS current_sl DECIMAL(18,6);`);
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS current_tp DECIMAL(18,6);`);
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS pip_size DECIMAL(12,6) DEFAULT 0.0001;`);
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS trailing_stop_enabled BOOLEAN DEFAULT false;`);
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS trailing_distance_pips DECIMAL(10,2);`);
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS trail_trigger_pips DECIMAL(10,2);`);
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS breakeven_trigger_pips DECIMAL(10,2);`);
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS breakeven_triggered BOOLEAN DEFAULT false;`);
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS peak_price DECIMAL(18,6);`);
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS trailing_log JSONB DEFAULT '[]'::jsonb;`);
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS sl_pips DECIMAL(10,2);`);
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS tp_pips DECIMAL(10,2);`);
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS risk_reward VARCHAR(20);`);
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS type VARCHAR(20);`);
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS error_message TEXT;`);
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`);
    } catch (e) { /* ignore */ }

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
      await client.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS sync_schedules JSONB DEFAULT '["07:00"]'::jsonb;`);


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
    // SYSTEM CONFIGURATION (Expanded with categories)
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        category VARCHAR(50) DEFAULT 'general',
        is_secret BOOLEAN DEFAULT false,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Add category + is_secret columns if missing
    try {
      await client.query(`ALTER TABLE system_config ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general';`);
      await client.query(`ALTER TABLE system_config ADD COLUMN IF NOT EXISTS is_secret BOOLEAN DEFAULT false;`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_system_config_category ON system_config(category);`);
    } catch (e) { /* ignore */ }
    
    // Seed comprehensive config defaults
    await client.query(`
      INSERT INTO system_config (key, value, description, category, is_secret) VALUES
        -- Payment Gateway
        ('STRIPE_SECRET_KEY', '', 'Stripe API Secret Key', 'payment', true),
        ('STRIPE_PUBLISHABLE_KEY', '', 'Stripe Publishable Key', 'payment', false),
        ('STRIPE_WEBHOOK_SECRET', '', 'Stripe Webhook Signing Secret', 'payment', true),
        ('CRYPTO_WALLET_ADDRESS', '', 'ที่อยู่กระเป๋า USDT (TRC20)', 'payment', false),
        ('CRYPTO_NETWORK', 'TRC20', 'เครือข่ายคริปโต', 'payment', false),
        ('BANK_ACCOUNT_INFO', '', 'ข้อมูลบัญชีธนาคาร', 'payment', false),
        ('PROMPTPAY_ID', '', 'เบอร์โทร/เลขบัตรสำหรับ PromptPay', 'payment', false),
        ('PAYMENT_ENABLED', 'false', 'เปิด/ปิดระบบชำระเงิน', 'payment', false),
        ('MIN_DEPOSIT', '100', 'จำนวนฝากขั้นต่ำ (USD)', 'payment', false),
        ('MIN_WITHDRAWAL', '50', 'จำนวนถอนขั้นต่ำ (USD)', 'payment', false),

        -- Notification
        ('SMTP_HOST', '', 'SMTP Server', 'notification', false),
        ('SMTP_PORT', '587', 'SMTP Port', 'notification', false),
        ('SMTP_USER', '', 'SMTP Username', 'notification', false),
        ('SMTP_PASS', '', 'SMTP Password', 'notification', true),
        ('SMTP_FROM', 'noreply@nexusfx.biz', 'Email ผู้ส่ง', 'notification', false),
        ('LINE_NOTIFY_DEFAULT_TOKEN', '', 'Default Line Notify Token', 'notification', true),
        ('TELEGRAM_BOT_TOKEN', '', 'Default Telegram Bot Token', 'notification', true),

        -- B2B / White-label
        ('B2B_ENABLED', 'true', 'เปิด/ปิดระบบ B2B Agent', 'b2b', false),
        ('DEFAULT_COMMISSION_RATE', '10', 'อัตราค่าคอมมิชชั่นเริ่มต้น (%)', 'b2b', false),
        ('COMMISSION_CALC_INTERVAL', '14400000', 'ช่วงเวลาคำนวณคอมมิชชั่น (มิลลิวินาที, default 4 ชม.)', 'b2b', false),
        ('AGENT_MAX_TEAM_SIZE', '100', 'จำนวนสมาชิกสูงสุดต่อ Agent', 'b2b', false),
        ('WHITE_LABEL_CUSTOM_DOMAIN', 'false', 'อนุญาตให้ Agent ใช้ Custom Domain', 'b2b', false),

        -- Security
        ('MFA_ENFORCE', 'false', 'บังคับใช้ MFA สำหรับทุกผู้ใช้', 'security', false),
        ('SESSION_TIMEOUT', '3600', 'Timeout ของ Session (วินาที)', 'security', false),
        ('JWT_EXPIRY', '24h', 'อายุ JWT Token', 'security', false),
        ('PASSWORD_MIN_LENGTH', '8', 'ความยาว Password ขั้นต่ำ', 'security', false),
        ('IP_WHITELIST', '', 'IP ที่อนุญาต (คั่นด้วย comma, ว่าง = อนุญาตทั้งหมด)', 'security', false),
        ('BRUTE_FORCE_LOCKOUT', '5', 'ล็อคหลังเข้าสู่ระบบล้มเหลว N ครั้ง', 'security', false),
        ('AUDIT_RETENTION_DAYS', '365', 'จำนวนวันเก็บ Audit Log', 'security', false)

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
        ('super_admin', 'Platform owner with full system control', true),
        ('admin', 'System Administrator with full access', true),
        ('agent', 'B2B Partner/Agent who manages a team of traders', true),
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
        ('bot.view', 'bot', 'View bot status'),
        ('agent.team', 'agent', 'Manage agent team members'),
        ('agent.invite', 'agent', 'Create team invitations'),
        ('agent.branding', 'agent', 'Customize branding settings'),
        ('agent.commission', 'agent', 'View agent commissions'),
        ('agent.dashboard', 'agent', 'View agent team dashboard'),
        ('admin.agents', 'admin', 'Manage all agents')
      ON CONFLICT (slug) DO NOTHING;
    `);

    // Assign permissions to roles
    // Super Admin gets all permissions
    await client.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r, permissions p WHERE r.role_name = 'super_admin'
      ON CONFLICT DO NOTHING;
    `);

    // Admin gets all permissions
    await client.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r, permissions p WHERE r.role_name = 'admin'
      ON CONFLICT DO NOTHING;
    `);

    // Agent gets agent + trading + group + finance + report permissions
    await client.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r, permissions p
      WHERE r.role_name = 'agent'
        AND p.slug IN ('dashboard.view','trade.view','trade.execute','account.manage',
                       'finance.deposit','finance.withdraw','finance.view',
                       'group.create','group.manage','group.view_team',
                       'report.view','report.export','settings.manage','bot.manage','bot.view',
                       'agent.team','agent.invite','agent.branding','agent.commission','agent.dashboard')
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

    // =============================================
    // B2B / AGENT COMMISSIONS
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_commissions (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        agent_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        commission_type VARCHAR(30) NOT NULL DEFAULT 'subscription',
        amount DECIMAL(18,2) NOT NULL DEFAULT 0,
        rate_pct DECIMAL(5,2) NOT NULL DEFAULT 10,
        reference_id VARCHAR(100),
        description TEXT,
        status VARCHAR(20) DEFAULT 'PENDING',
        settled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // =============================================
    // B2B / AGENT INVITATIONS
    // =============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_invitations (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        invited_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invite_code VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255),
        max_uses INTEGER DEFAULT 1,
        used_count INTEGER DEFAULT 0,
        expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // B2B indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_commissions_tenant ON agent_commissions(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_agent_commissions_agent ON agent_commissions(agent_user_id);
      CREATE INDEX IF NOT EXISTS idx_agent_invitations_tenant ON agent_invitations(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_agent_invitations_code ON agent_invitations(invite_code);
      CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
    `);

    // Add commission engine columns (safe to re-run)
    try {
      await client.query(`
        ALTER TABLE agent_commissions ADD COLUMN IF NOT EXISTS source_trade_id INTEGER;
        ALTER TABLE agent_commissions ADD COLUMN IF NOT EXISTS base_amount DECIMAL(18,2) DEFAULT 0;
        ALTER TABLE agent_commissions ADD COLUMN IF NOT EXISTS trade_closed_at TIMESTAMPTZ;
        CREATE INDEX IF NOT EXISTS idx_agent_commissions_trade ON agent_commissions(source_trade_id);
        CREATE INDEX IF NOT EXISTS idx_agent_commissions_status ON agent_commissions(status);
      `);
    } catch (e) { /* columns may already exist */ }

    // =============================================
    // DATA MIGRATION: Merge USDT wallets into USD wallets
    // =============================================
    try {
      await client.query(`
        UPDATE wallets w1
        SET balance = w1.balance + (SELECT w2.balance FROM wallets w2 WHERE w2.user_id = w1.user_id AND w2.currency = 'USDT' LIMIT 1)
        WHERE w1.currency = 'USD'
        AND EXISTS (SELECT 1 FROM wallets w2 WHERE w2.user_id = w1.user_id AND w2.currency = 'USDT');
      `);
      
      await client.query(`
        UPDATE financial_transactions ft
        SET wallet_id = (SELECT id FROM wallets w WHERE w.user_id = ft.user_id AND w.currency = 'USD' LIMIT 1)
        WHERE wallet_id IN (SELECT id FROM wallets WHERE currency = 'USDT');
      `);
      
      await client.query(`DELETE FROM wallets WHERE currency = 'USDT';`);
    } catch (e) {
      console.warn('⚠️ USDT to USD wallet migration skipped or failed:', e.message);
    }

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

    // Market Candles (From DataFeed EA)
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS market_candles (
          id SERIAL PRIMARY KEY,
          broker VARCHAR(50) NOT NULL DEFAULT 'EXNESS',
          symbol VARCHAR(20) NOT NULL,
          interval VARCHAR(10) NOT NULL,
          open_time BIGINT NOT NULL,
          open DECIMAL(18,6) NOT NULL,
          high DECIMAL(18,6) NOT NULL,
          low DECIMAL(18,6) NOT NULL,
          close DECIMAL(18,6) NOT NULL,
          volume DECIMAL(18,6) DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(broker, symbol, interval, open_time)
        );
        -- Alter existing table to add broker support
        ALTER TABLE market_candles ADD COLUMN IF NOT EXISTS broker VARCHAR(50) DEFAULT 'EXNESS';
        ALTER TABLE market_candles DROP CONSTRAINT IF EXISTS market_candles_symbol_interval_open_time_key;
        ALTER TABLE market_candles DROP CONSTRAINT IF EXISTS market_candles_broker_symbol_interval_open_time_key;
        ALTER TABLE market_candles ADD CONSTRAINT market_candles_broker_symbol_interval_open_time_key UNIQUE(broker, symbol, interval, open_time);
        
        CREATE INDEX IF NOT EXISTS idx_market_candles_lookup ON market_candles(broker, symbol, interval, open_time DESC);
      `);
    } catch (e) { console.error('Migration error candles:', e); }

    console.log('✅ Database schema initialized successfully');
  } catch (err) {
    console.error('❌ Error initializing database:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Initialize datacenter database schema (market_candles)
async function initDatacenterDB() {
  const client = await datacenterPool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS market_candles (
        id SERIAL PRIMARY KEY,
        broker VARCHAR(50) NOT NULL DEFAULT 'EXNESS',
        symbol VARCHAR(20) NOT NULL,
        timeframe VARCHAR(10) NOT NULL,
        "timestamp" TIMESTAMPTZ NOT NULL,
        open NUMERIC NOT NULL,
        high NUMERIC NOT NULL,
        low NUMERIC NOT NULL,
        close NUMERIC NOT NULL,
        volume NUMERIC DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(broker, symbol, timeframe, "timestamp")
      );
      CREATE INDEX IF NOT EXISTS idx_candles_lookup 
        ON market_candles(broker, symbol, timeframe, "timestamp" DESC);
    `);
    console.log('✅ Datacenter DB schema initialized (market_candles)');
  } catch (err) {
    console.error('⚠️ Datacenter DB init error:', err.message);
  } finally {
    client.release();
  }
}

module.exports = { pool, datacenterPool, initDatabase, initDatacenterDB };
