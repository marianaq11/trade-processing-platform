CREATE TABLE trade (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_trade_id  VARCHAR(64)    NOT NULL,
    account_id       BIGINT         NOT NULL REFERENCES account (id),
    instrument_id    BIGINT         NOT NULL REFERENCES instrument (id),
    side             VARCHAR(4)     NOT NULL CHECK (side IN ('BUY', 'SELL')),
    quantity         BIGINT         NOT NULL CHECK (quantity > 0),
    price            NUMERIC(19, 4) NOT NULL CHECK (price > 0),
    notional         NUMERIC(19, 4) NOT NULL,
    trade_date       DATE           NOT NULL,
    settlement_date  DATE           NOT NULL,
    status           VARCHAR(20)    NOT NULL,
    rejection_reason VARCHAR(40),
    rejection_detail VARCHAR(255),
    submitted_by     VARCHAR(50)    NOT NULL,
    created_at       TIMESTAMPTZ    NOT NULL,
    updated_at       TIMESTAMPTZ    NOT NULL,
    version          BIGINT         NOT NULL,
    CONSTRAINT uq_trade_account_client_trade_id UNIQUE (account_id, client_trade_id)
);

CREATE INDEX idx_trade_status ON trade (status);
-- Used by the daily notional risk check
CREATE INDEX idx_trade_account_trade_date ON trade (account_id, trade_date);

CREATE TABLE trade_event (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trade_id     BIGINT       NOT NULL REFERENCES trade (id),
    from_status  VARCHAR(20),
    to_status    VARCHAR(20)  NOT NULL,
    detail       VARCHAR(255),
    performed_by VARCHAR(50)  NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL
);

CREATE INDEX idx_trade_event_trade_id ON trade_event (trade_id);
