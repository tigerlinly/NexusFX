const WebSocket = require('ws');

class BinanceFeed {
  constructor(io) {
    this.io = io;
    this.ws = null;
    this.prices = {};
    // We only care about a few major symbols for the demo
    this.symbols = ['btcusdt', 'ethusdt', 'eurusdt', 'gbpusdt', 'xauusdt', 'solusdt', 'bnbusdt', 'adtausdt'];
    this.reconnectTimeout = null;
  }

  start() {
    this.connect();
    
    // Broadcast cached prices periodically to ensure late clients get it
    setInterval(() => {
      if (Object.keys(this.prices).length > 0) {
        this.io.emit('market_prices', this.prices);
      }
    }, 1000); // broadcast every second to throttle updates
  }

  connect() {
    try {
      // Connect to Binance Aggregate Trade / Mini Ticker Streams
      const streams = this.symbols.map(s => `${s}@miniTicker`).join('/');
      const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;
      
      console.log(`[BinanceFeed] Connecting to ${wsUrl}`);
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        console.log('✅ [BinanceFeed] Connected to Binance Live Feed');
        clearTimeout(this.reconnectTimeout);
      });

      this.ws.on('message', (data) => {
        try {
          const payload = JSON.parse(data);
          if (payload && payload.data) {
            const { s: symbol, c: closePrice } = payload.data;
            if (symbol && closePrice) {
              this.prices[symbol] = parseFloat(closePrice);
            }
          }
        } catch (err) {
          // ignore parse errors
        }
      });

      this.ws.on('close', () => {
        console.log('❌ [BinanceFeed] Disconnected. Reconnecting in 5s...');
        this.reconnect();
      });

      this.ws.on('error', (err) => {
        console.error('❌ [BinanceFeed] Error:', err.message);
        this.ws.close();
      });
    } catch (e) {
        console.error('❌ [BinanceFeed] Connection Failed:', e.message);
        this.reconnect();
    }
  }

  reconnect() {
    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, 5000);
  }
}

module.exports = BinanceFeed;
