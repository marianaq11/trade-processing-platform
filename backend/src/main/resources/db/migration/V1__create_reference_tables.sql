CREATE TABLE account (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code       VARCHAR(20)  NOT NULL UNIQUE,
    name       VARCHAR(100) NOT NULL,
    status     VARCHAR(20)  NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE instrument (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    symbol          VARCHAR(10)   NOT NULL UNIQUE,
    name            VARCHAR(100)  NOT NULL,
    reference_price NUMERIC(19, 4) NOT NULL CHECK (reference_price > 0),
    active          BOOLEAN       NOT NULL DEFAULT TRUE
);
