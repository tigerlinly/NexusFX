-- Reset all wallet balances to 0
UPDATE wallets SET balance = 0, locked_balance = 0, updated_at = NOW();

-- Delete fee transactions
DELETE FROM financial_transactions WHERE type = 'FEE';

-- Delete fee logs
DELETE FROM service_fee_logs;

-- Verify
SELECT id, user_id, balance, locked_balance FROM wallets ORDER BY user_id;
SELECT COUNT(*) as remaining_fee_tx FROM financial_transactions WHERE type = 'FEE';
