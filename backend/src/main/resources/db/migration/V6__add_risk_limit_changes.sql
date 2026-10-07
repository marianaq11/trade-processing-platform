-- Lets the UI detect that someone else edited the limits after they were loaded.
ALTER TABLE risk_limit ADD COLUMN version BIGINT NOT NULL DEFAULT 0;

-- One row per field changed. Editing two limits at once produces two rows with the same
-- reason and timestamp. old_value is null when limits are set up for the first time.
CREATE TABLE risk_limit_change (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT         NOT NULL REFERENCES account (id),
    field      VARCHAR(30)    NOT NULL,
    old_value  NUMERIC(19, 2),
    new_value  NUMERIC(19, 2) NOT NULL,
    reason     VARCHAR(255)   NOT NULL,
    changed_by VARCHAR(50)    NOT NULL,
    changed_at TIMESTAMPTZ    NOT NULL
);

CREATE INDEX idx_risk_limit_change_account ON risk_limit_change (account_id, changed_at);
CREATE INDEX idx_risk_limit_change_changed_at ON risk_limit_change (changed_at);
