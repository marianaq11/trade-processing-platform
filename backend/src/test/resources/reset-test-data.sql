-- Runs before every integration test. Puts trades and risk limits back to what the seed
-- migrations created, since all test classes share one database.
TRUNCATE trade_event, trade, risk_limit_change;

DELETE FROM risk_limit;

INSERT INTO risk_limit (account_id, max_trade_notional, max_daily_notional, price_tolerance_pct)
SELECT id, 1000000.00, 5000000.00, 10.00 FROM account WHERE code = 'ACC-1001';

INSERT INTO risk_limit (account_id, max_trade_notional, max_daily_notional, price_tolerance_pct)
SELECT id, 250000.00, 1000000.00, 5.00 FROM account WHERE code = 'ACC-1002';

INSERT INTO risk_limit (account_id, max_trade_notional, max_daily_notional, price_tolerance_pct)
SELECT id, 500000.00, 2000000.00, 10.00 FROM account WHERE code = 'ACC-1004';
