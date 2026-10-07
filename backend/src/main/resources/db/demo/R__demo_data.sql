-- Sample history so a fresh database has something to look at: four business days of
-- settled, rejected and cancelled trades, the last day's trades still waiting to settle,
-- and a couple of risk limit changes. Dates are relative to today (New York time).
--
-- Only loaded for local runs (see spring.flyway.locations); tests use db/migration only.
-- Each part only runs against empty tables, so it never touches real data.

WITH today AS (
    SELECT (now() AT TIME ZONE 'America/New_York')::date AS d
),
business_days AS (
    SELECT day::date AS day, row_number() OVER (ORDER BY day DESC) AS days_back
    FROM today, generate_series(today.d - 10, today.d - 1, interval '1 day') AS day
    WHERE extract(isodow FROM day) < 6
),
samples (ref, days_back, at_time, trader, account_code, symbol, side, quantity, price, outcome, reason, detail) AS (
    VALUES
    -- 4 business days ago
    (1,  4, '09:41:12', 'trader1', 'ACC-1001', 'AAPL',  'BUY',  1200,  228.45, 'SETTLED',   NULL, NULL),
    (2,  4, '10:05:37', 'trader2', 'ACC-1002', 'MSFT',  'BUY',   400,  451.20, 'SETTLED',   NULL, NULL),
    (3,  4, '11:17:03', 'trader1', 'ACC-1001', 'NVDA',  'SELL', 3000,  141.10, 'SETTLED',   NULL, NULL),
    (4,  4, '13:02:48', 'trader2', 'ACC-1004', 'XOM',   'BUY',   800,  114.90, 'REJECTED',  'ACCOUNT_SUSPENDED',
        'Account ACC-1004 is suspended'),
    (5,  4, '14:26:19', 'trader1', 'ACC-1001', 'KO',    'BUY',  5000,   69.85, 'SETTLED',   NULL, NULL),
    -- 3 business days ago
    (6,  3, '09:33:51', 'trader2', 'ACC-1002', 'JPM',   'SELL',  600,  249.30, 'SETTLED',   NULL, NULL),
    (7,  3, '10:12:09', 'trader1', 'ACC-1001', 'AMZN',  'BUY',  2000,  232.75, 'REJECTED',  'PRICE_OUT_OF_TOLERANCE',
        'Price 232.75 is 10.83% away from reference price 210 (limit 10.00%)'),
    (8,  3, '10:58:44', 'trader1', 'ACC-1001', 'AMZN',  'BUY',  2000,  210.35, 'SETTLED',   NULL, NULL),
    (9,  3, '13:40:15', 'trader2', 'ACC-1003', 'GOOGL', 'BUY',   300,  180.40, 'REJECTED',  'NO_RISK_LIMITS',
        'No risk limits are set up for account ACC-1003'),
    (10, 3, '15:21:30', 'trader2', 'ACC-1002', 'AAPL',  'BUY',   900,  229.90, 'CANCELLED', NULL,
        'Booked to the wrong account, client confirmed by phone'),
    -- 2 business days ago (ACC-1002 runs into its 1M daily limit)
    (11, 2, '09:30:22', 'trader1', 'ACC-1001', 'MSFT',  'BUY',  2500,  449.10, 'REJECTED',  'TRADE_NOTIONAL_LIMIT',
        'Notional 1,122,750.00 is over the single-trade limit of 1,000,000.00'),
    (12, 2, '09:36:05', 'trader1', 'ACC-1001', 'MSFT',  'BUY',  2000,  449.10, 'SETTLED',   NULL, NULL),
    (13, 2, '11:48:57', 'trader2', 'ACC-1002', 'AAPL',  'BUY',  1000,  231.00, 'SETTLED',   NULL, NULL),
    (14, 2, '12:15:33', 'trader2', 'ACC-1002', 'NVDA',  'BUY',  1700,  139.80, 'SETTLED',   NULL, NULL),
    (15, 2, '13:55:10', 'trader2', 'ACC-1002', 'JPM',   'BUY',   950,  251.40, 'SETTLED',   NULL, NULL),
    (16, 2, '14:47:26', 'trader2', 'ACC-1002', 'MSFT',  'BUY',   540,  452.00, 'SETTLED',   NULL, NULL),
    (17, 2, '15:32:41', 'trader2', 'ACC-1002', 'KO',    'BUY',  1500,   70.10, 'REJECTED',  'DAILY_NOTIONAL_LIMIT',
        'Would bring today''s notional to 1,056,720.00, over the daily limit of 1,000,000.00'),
    -- last business day: these settle today
    (18, 1, '09:45:18', 'trader1', 'ACC-1001', 'GOOGL', 'BUY',  2200,  181.25, 'ACCEPTED',  NULL, NULL),
    (19, 1, '10:20:44', 'trader2', 'ACC-1002', 'AAPL',  'SELL',  800,  229.40, 'ACCEPTED',  NULL, NULL),
    (20, 1, '11:05:09', 'trader1', 'ACC-1001', 'BBBY',  'BUY', 10000,    0.12, 'REJECTED',  'INSTRUMENT_INACTIVE',
        'BBBY is not currently tradable'),
    (21, 1, '13:30:52', 'trader1', 'ACC-1001', 'XOM',   'SELL', 4000,  115.60, 'ACCEPTED',  NULL, NULL),
    (22, 1, '14:12:37', 'trader2', 'ACC-1002', 'KO',    'BUY',  3000,   69.90, 'ACCEPTED',  NULL, NULL),
    (23, 1, '15:08:03', 'trader1', 'ACC-1001', 'NVDA',  'BUY',  1500,  140.55, 'CANCELLED', NULL,
        'Duplicate of an earlier booking')
),
trades AS (
    SELECT s.*,
           b.day AS trade_date,
           b.day + CASE extract(isodow FROM b.day) WHEN 5 THEN 3 ELSE 1 END AS settlement_date,
           (b.day + s.at_time::time) AT TIME ZONE 'America/New_York' AS received_at,
           coalesce(s.reason IN ('ACCOUNT_SUSPENDED', 'INSTRUMENT_INACTIVE'), FALSE) AS failed_validation
    FROM samples s
    JOIN business_days b ON b.days_back = s.days_back
),
timed AS (
    SELECT t.*,
           (t.settlement_date + time '18:00') AT TIME ZONE 'America/New_York' AS settled_at,
           t.received_at + interval '2 hours 14 minutes' AS cancelled_at
    FROM trades t
),
inserted AS (
    INSERT INTO trade (client_trade_id, account_id, instrument_id, side, quantity, price, notional,
                       trade_date, settlement_date, status, rejection_reason, rejection_detail,
                       submitted_by, created_at, updated_at, version)
    SELECT 'demo-' || t.ref, a.id, i.id, t.side, t.quantity, t.price, t.quantity * t.price,
           t.trade_date, t.settlement_date, t.outcome, t.reason,
           CASE WHEN t.outcome = 'REJECTED' THEN t.detail END,
           t.trader, t.received_at,
           CASE t.outcome
               WHEN 'SETTLED' THEN t.settled_at
               WHEN 'CANCELLED' THEN t.cancelled_at
               ELSE t.received_at + interval '40 milliseconds'
           END,
           0
    FROM timed t
    JOIN account a ON a.code = t.account_code
    JOIN instrument i ON i.symbol = t.symbol
    WHERE NOT EXISTS (SELECT 1 FROM trade)
    ORDER BY t.ref
    RETURNING id, client_trade_id
)
INSERT INTO trade_event (trade_id, from_status, to_status, detail, performed_by, created_at)
SELECT ins.id, e.from_status, e.to_status, e.detail, e.performed_by, e.created_at
FROM inserted ins
JOIN timed t ON 'demo-' || t.ref = ins.client_trade_id
CROSS JOIN LATERAL (VALUES
    (1, NULL,        'RECEIVED',  'Trade received',     t.trader, t.received_at, TRUE),
    (2, 'RECEIVED',  'VALIDATED', 'Passed validation',  'system', t.received_at + interval '20 milliseconds',
        NOT t.failed_validation),
    (3, 'RECEIVED',  'REJECTED',  t.detail,             'system', t.received_at + interval '20 milliseconds',
        t.failed_validation),
    (4, 'VALIDATED', 'REJECTED',  t.detail,             'system', t.received_at + interval '40 milliseconds',
        t.outcome = 'REJECTED' AND NOT t.failed_validation),
    (5, 'VALIDATED', 'ACCEPTED',  'Passed risk checks', 'system', t.received_at + interval '40 milliseconds',
        t.outcome IN ('ACCEPTED', 'SETTLED', 'CANCELLED')),
    (6, 'ACCEPTED',  'SETTLED',   'Settled',            'system', t.settled_at, t.outcome = 'SETTLED'),
    (7, 'ACCEPTED',  'CANCELLED', t.detail,             'ops1',   t.cancelled_at, t.outcome = 'CANCELLED')
) AS e (step, from_status, to_status, detail, performed_by, created_at, applies)
WHERE e.applies
ORDER BY ins.id, e.step;


-- Two earlier limit changes, so the audit log isn't empty. The current values in risk_limit
-- (from V4) are the "after" values here.
WITH today AS (
    SELECT (now() AT TIME ZONE 'America/New_York')::date AS d
),
changes (account_code, field, old_value, new_value, reason, days_ago, at_time) AS (
    VALUES
    ('ACC-1001', 'MAX_DAILY_NOTIONAL',  4000000.00, 5000000.00, 'Q4 allocation increase approved by credit committee', 6, '08:52:10'),
    ('ACC-1002', 'PRICE_TOLERANCE_PCT',       7.50,       5.00, 'Tighter price check after a mistyped order last week', 5, '16:20:45'),
    ('ACC-1002', 'MAX_TRADE_NOTIONAL',   300000.00,  250000.00, 'Tighter price check after a mistyped order last week', 5, '16:20:45')
),
inserted AS (
    INSERT INTO risk_limit_change (account_id, field, old_value, new_value, reason, changed_by, changed_at)
    SELECT a.id, c.field, c.old_value, c.new_value, c.reason, 'risk1',
           ((today.d - c.days_ago) + c.at_time::time) AT TIME ZONE 'America/New_York'
    FROM changes c
    CROSS JOIN today
    JOIN account a ON a.code = c.account_code
    WHERE NOT EXISTS (SELECT 1 FROM risk_limit_change)
    RETURNING account_id, changed_at
)
UPDATE risk_limit r
SET updated_by = 'risk1',
    updated_at = latest.changed_at,
    version = 1
FROM (SELECT account_id, max(changed_at) AS changed_at FROM inserted GROUP BY account_id) AS latest
WHERE r.account_id = latest.account_id;
