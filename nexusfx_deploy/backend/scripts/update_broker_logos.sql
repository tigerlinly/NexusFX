-- Update brokers table logo_url to use local paths
UPDATE brokers SET logo_url = '/logos/icmarkets.png' WHERE LOWER(name) LIKE '%ic market%';
UPDATE brokers SET logo_url = '/logos/xm.png' WHERE LOWER(name) = 'xm';
UPDATE brokers SET logo_url = '/logos/exness.png' WHERE LOWER(name) = 'exness';
UPDATE brokers SET logo_url = '/logos/pepperstone.png' WHERE LOWER(name) = 'pepperstone';
UPDATE brokers SET logo_url = '/logos/fbs.png' WHERE LOWER(name) = 'fbs';
UPDATE brokers SET logo_url = '/logos/fxgt.png' WHERE LOWER(name) = 'fxgt';
UPDATE brokers SET logo_url = '/logos/tickmill.png' WHERE LOWER(name) = 'tickmill';
UPDATE brokers SET logo_url = '/logos/roboforex.png' WHERE LOWER(name) LIKE '%roboforex%';
UPDATE brokers SET logo_url = '/logos/vantage.png' WHERE LOWER(name) = 'vantage';
UPDATE brokers SET logo_url = '/logos/octafx.png' WHERE LOWER(name) = 'octafx';
UPDATE brokers SET logo_url = '/logos/hfm.png' WHERE LOWER(name) = 'hfm';
UPDATE brokers SET logo_url = '/logos/fxtm.png' WHERE LOWER(name) = 'fxtm';
UPDATE brokers SET logo_url = '/logos/fxpro.png' WHERE LOWER(name) = 'fxpro';
UPDATE brokers SET logo_url = '/logos/oanda.png' WHERE LOWER(name) = 'oanda';
UPDATE brokers SET logo_url = '/logos/avatrade.png' WHERE LOWER(name) = 'avatrade';

-- Verify
SELECT id, name, logo_url FROM brokers ORDER BY id;
