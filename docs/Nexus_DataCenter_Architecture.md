# NexusFX Market Data Center (Architecture Design)

สถาปัตยกรรมศูนย์กลางข้อมูลราคาตลาด (Data Feeder Infrastructure) ที่ออกแบบมาเพื่อรองรับการขยายสเกลสู่การเป็นผู้ให้บริการ API แบบ 100%

```mermaid
graph TD
    %% --- External Sources ---
    subgraph Data Sources (Upstream)
        MT5[MT5 Bridge EA] -->|WebSocket / HTTP Post| Gateway
        Binance[Crypto API / Binance WSS] -->|WebSocket| Gateway
        Other[Other Feeds e.g. OANDA / Tiingo] -.->|API| Gateway
    end

    %% --- Ingestion Layer ---
    subgraph Nexus Data Center (Ingestion)
        Gateway[Data Gateway / Normalizer]
        Gateway -->|Publishes Standardized Ticks| Redis[(Redis Pub/Sub)]
    end

    %% --- Storage & Processing ---
    subgraph Persistence Layer (Storage)
        Redis -->|Batch Insert/Stream| TSDB[(PostgreSQL + TimescaleDB)]
        TSDB -.->|Aggregates into| Candles[market_candles Table]
    end

    %% --- Consumers (Distribution) ---
    subgraph Consumers (Downstream)
        Redis -->|Subscribes to live stream| TradeBot(Node.js AutoBot Engine)
        Redis -->|Live Price Feed| WebDashboard(Frontend Dashboards)
        
        TradeBot -->|Query Historical| TSDB
        WebDashboard -->|Query Fast Charts| TSDB
        
        ExternalDev(External API Users) -->|REST / WS| APIGW[API Gateway Rate Limiter]
        APIGW --> TSDB
        APIGW --> Redis
    end

    %% Styles
    classDef source fill:#f9f,stroke:#333,stroke-width:2px;
    classDef core fill:#bbf,stroke:#333,stroke-width:2px;
    classDef storage fill:#bfb,stroke:#333,stroke-width:2px;
    classDef consumer fill:#fbb,stroke:#333,stroke-width:2px;
    
    class MT5,Binance,Other source;
    class Gateway,Redis,APIGW core;
    class TSDB,Candles storage;
    class TradeBot,WebDashboard,ExternalDev consumer;
```

## องค์ประกอบหลัก (Core Components)

1.  **Data Gateway (The Normalizer):** ตัวรับข้อมูลจากหลายแหล่ง (MT5, Crypto API) หน้าที่หลักคือแปลงข้อมูลต่างฟอร์แมต ให้กลายเป็นภาษาเดียวกัน (เช่น `{ symbol: "XAUUSD", bid: 2000, ask: 2000.5, timestamp: 123456 }`)
2.  **Redis Pub/Sub (The Nerve System):** เส้นประสาทหลักที่ทำหน้าที่ "กระจายเสียง" เวลามีราคาใหม่เข้ามา บอทเทรดและหน้าเว็บจะดักฟังที่นี่ ทำให้ตอบสนองได้เร็วระดับมิลลิวินาที โดยไม่ต้องไปเคาะโหลด Database ตลอดเวลา
3.  **TimescaleDB / PostgreSQL (The Vault):** จัดเก็บข้อมูลย้อนหลัง (Historical Data) ฐานข้อมูล `market_candles` จะถูกทำเป็น Time-Series Database เพื่อรองรับการเก็บข้อมูลมหาศาลโดยที่คิวรี่ไม่ช้าลง
4.  **Distribution (การขยายบริการให้คนอื่นเช่า):** เมื่อระบบข้างต้นนิ่งแล้ว เราสามารถเปิดตึก `API Gateway` เพื่อขายบริการให้ Programmer ภายนอกมาดึงราคาไปใช้ โดยผ่านระบบกรอง (Rate Limiter) กันเซิร์ฟเวอร์เราล่ม

## การตั้งค่า Database (TimescaleDB) บนเซิร์ฟเวอร์ INET

เซิร์ฟเวอร์ Data Center ปัจจุบันรันอยู่บน INET Server (Dockerized) โดยใช้ **TimescaleDB** ซึ่งถูกตั้งค่าเป็น Single Table Partitioning (Hypertable) เพื่อง่ายต่อการเขียนโค้ดและรองรับข้อมูลมหาศาลโดยความเร็วไม่ตก

### Database Connection String
*ไปผูกใช้ใน Node.js, Prisma หรือ DBeaver ได้ทันที:*
```text
Host: 203.151.66.51
Port: 5432
User: nexus_admin
Password: N3xusFX_DataC3nter2026!
Database: nexusfx_datacenter

# Connection URL:
postgresql://nexus_admin:N3xusFX_DataC3nter2026!@203.151.66.51:5432/nexusfx_datacenter?schema=public
```

### Table Schema (`market_candles`)
เราใช้ท่ารวบทุก Broker ไว้ในตารางเดียว (Single Table with Broker Tag) 

```sql
CREATE TABLE market_candles (
    broker      VARCHAR(50) NOT NULL,  -- e.g., 'GBE', 'EXNESS'
    symbol      VARCHAR(20) NOT NULL,  -- e.g., 'XAUUSD'
    timeframe   VARCHAR(5)  NOT NULL,  -- e.g., 'M1', 'H1'
    timestamp   TIMESTAMPTZ NOT NULL,
    open        NUMERIC(12, 5) NOT NULL,
    high        NUMERIC(12, 5) NOT NULL,
    low         NUMERIC(12, 5) NOT NULL,
    close       NUMERIC(12, 5) NOT NULL,
    volume      NUMERIC(15, 2) DEFAULT 0,
    PRIMARY KEY (broker, symbol, timeframe, timestamp)
);

-- Hypertable and Compression Config
SELECT create_hypertable('market_candles', 'timestamp');
ALTER TABLE market_candles SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'broker, symbol, timeframe'
);
SELECT add_compression_policy('market_candles', INTERVAL '7 days');

-- Performance Index
CREATE INDEX idx_candles_lookup ON market_candles (broker, symbol, timeframe, timestamp DESC);
```
