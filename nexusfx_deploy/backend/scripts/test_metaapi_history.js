const { pool } = require('../config/database');
const MetaApi = require('metaapi.cloud-sdk').default;

async function run() {
  const res = await pool.query(`SELECT a.id, a.metaapi_account_id, us.metaapi_token 
    FROM accounts a JOIN user_settings us ON us.user_id = a.user_id 
    WHERE a.is_active = true AND a.metaapi_account_id IS NOT NULL LIMIT 1`);
  if (res.rows.length === 0) return console.log('no accounts');
  const acc = res.rows[0];
  
  const api = new MetaApi(acc.metaapi_token);
  const account = await api.metatraderAccountApi.getAccount(acc.metaapi_account_id);
  if (account.state !== 'DEPLOYED') await account.deploy();
  
  const connection = account.getRPCConnection();
  await connection.connect();
  await connection.waitSynchronized();
  
  try {
     const startTime = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
     const endTime = new Date().toISOString();
     console.log('Fetching deals/history...');
     const history = await connection.getDealsByTimeRange(startTime, endTime);
     console.log('Deals sample:', JSON.stringify(history.slice(-3), null, 2));
  } catch(e) { console.error('Error fetching deals', e.message); }
  
  try {
     const startTime = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
     const endTime = new Date().toISOString();     
     const orders = await connection.getHistoryOrdersByTimeRange(startTime, endTime);
     console.log('Orders sample:', JSON.stringify(orders.slice(-3), null, 2));
  } catch(e) { console.error('Error fetching orders', e.message); }
  
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
