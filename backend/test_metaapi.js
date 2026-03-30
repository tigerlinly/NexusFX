/**
 * Test script to verify MetaAPI token and account connection
 * Run: node test_metaapi.js
 */
const MetaApi = require('metaapi.cloud-sdk').default;

// ========================================
// ใส่ค่าตรงนี้
// ========================================
const METAAPI_TOKEN = process.env.METAAPI_TOKEN || 'YOUR_TOKEN_HERE';
const ACCOUNT_ID = process.env.ACCOUNT_ID || '56ff9911-5ba6-45df-960c-0139a3ec5c4d';

async function testConnection() {
  console.log('🔍 Testing MetaAPI Connection...');
  console.log(`   Token (first 20 chars): ${METAAPI_TOKEN.substring(0, 20)}...`);
  console.log(`   Token length: ${METAAPI_TOKEN.length}`);
  console.log(`   Account ID: ${ACCOUNT_ID}`);
  console.log('');

  // Check token format
  if (METAAPI_TOKEN.includes(':')) {
    console.log('❌ ERROR: Token contains ":" — this looks like an ENCRYPTED value!');
    console.log('   The token should be a JWT starting with "eyJ..."');
    return;
  }

  if (!METAAPI_TOKEN.startsWith('eyJ')) {
    console.log('⚠️ WARNING: Token does not start with "eyJ" — might not be a valid JWT token');
  }

  try {
    const api = new MetaApi(METAAPI_TOKEN);
    console.log('✅ MetaApi SDK initialized successfully');

    console.log('📋 Getting account info...');
    const account = await api.metatraderAccountApi.getAccount(ACCOUNT_ID);
    
    console.log(`✅ Account found!`);
    console.log(`   Name: ${account.name}`);
    console.log(`   Login: ${account.login}`);
    console.log(`   Server: ${account.server}`);
    console.log(`   Platform: ${account.platform}`);
    console.log(`   State: ${account.state}`);
    
    if (account.state !== 'DEPLOYED') {
      console.log('   Deploying account...');
      await account.deploy();
    }

    console.log('🔌 Connecting via RPC...');
    const connection = account.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized();

    const info = await connection.getAccountInformation();
    console.log(`\n✅ CONNECTED SUCCESSFULLY!`);
    console.log(`   Balance: $${info.balance}`);
    console.log(`   Equity: $${info.equity}`);
    console.log(`   Leverage: ${info.leverage}`);
    console.log(`   Currency: ${info.currency}`);

    await connection.close();
    console.log('\n🎉 Test PASSED — MetaAPI is working!');

  } catch (err) {
    console.error(`\n❌ TEST FAILED: ${err.message}`);
    if (err.message.includes('invalid auth-token')) {
      console.error('   → Token is invalid or expired. Get a new token from https://app.metaapi.cloud');
    }
    if (err.message.includes('ERR_INVALID_CHAR')) {
      console.error('   → Token contains invalid characters. It may be encrypted.');
      console.error('   → Check that the token in the database is plain text, not encrypted ciphertext.');
    }
  }
}

testConnection();
