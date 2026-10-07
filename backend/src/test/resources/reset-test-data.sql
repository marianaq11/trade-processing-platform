-- Runs before every integration test. Puts trades, risk limits and entitlements back to what
-- the seed migrations created, since all test classes share one database.
TRUNCATE trade_event, trade, risk_limit_change;

DELETE FROM account_entitlement;

INSERT INTO account_entitlement (user_id, account_id)
SELECT u.id, a.id
FROM (VALUES ('trader1', 'ACC-1001'), ('trader1', 'ACC-1002'), ('trader1', 'ACC-1004'),
             ('trader2', 'ACC-1002'), ('trader2', 'ACC-1003'), ('trader2', 'ACC-1004')) AS e (username, code)
JOIN app_user u ON u.username = e.username
JOIN account a ON a.code = e.code;

DELETE FROM risk_limit;

INSERT INTO risk_limit (account_id, max_trade_notional, max_daily_notional, price_tolerance_pct)
SELECT id, 1000000.00, 5000000.00, 10.00 FROM account WHERE code = 'ACC-1001';

INSERT INTO risk_limit (account_id, max_trade_notional, max_daily_notional, price_tolerance_pct)
SELECT id, 250000.00, 1000000.00, 5.00 FROM account WHERE code = 'ACC-1002';

INSERT INTO risk_limit (account_id, max_trade_notional, max_daily_notional, price_tolerance_pct)
SELECT id, 500000.00, 2000000.00, 10.00 FROM account WHERE code = 'ACC-1004';
