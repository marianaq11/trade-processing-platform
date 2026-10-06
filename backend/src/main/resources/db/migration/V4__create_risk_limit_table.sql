CREATE TABLE risk_limit (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id          BIGINT         NOT NULL UNIQUE REFERENCES account (id),
    max_trade_notional  NUMERIC(19, 2) NOT NULL CHECK (max_trade_notional > 0),
    max_daily_notional  NUMERIC(19, 2) NOT NULL CHECK (max_daily_notional > 0),
    price_tolerance_pct NUMERIC(5, 2)  NOT NULL CHECK (price_tolerance_pct > 0 AND price_tolerance_pct <= 100),
    updated_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_by          VARCHAR(50)    NOT NULL DEFAULT 'system'
);

-- ACC-1003 intentionally has no limits yet, so its trades get rejected until someone sets them.
INSERT INTO risk_limit (account_id, max_trade_notional, max_daily_notional, price_tolerance_pct)
SELECT id, 1000000.00, 5000000.00, 10.00 FROM account WHERE code = 'ACC-1001';

INSERT INTO risk_limit (account_id, max_trade_notional, max_daily_notional, price_tolerance_pct)
SELECT id, 250000.00, 1000000.00, 5.00 FROM account WHERE code = 'ACC-1002';

INSERT INTO risk_limit (account_id, max_trade_notional, max_daily_notional, price_tolerance_pct)
SELECT id, 500000.00, 2000000.00, 10.00 FROM account WHERE code = 'ACC-1004';
