CREATE TABLE app_user (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    role          VARCHAR(20)  NOT NULL CHECK (role IN ('TRADER', 'OPERATIONS', 'RISK_MANAGER')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Demo users, all with the password "demo-pass" (BCrypt hashed). Listed in the README.
INSERT INTO app_user (username, password_hash, role) VALUES
    ('trader1', '$2a$10$2JqC9/16aeaCtrhot4oREuFDjdRnbtHdxaAsd1f2eiDHWHZEFaUyG', 'TRADER'),
    ('trader2', '$2a$10$6ir3IawyGe/JPOj8dQ875efkMtDB6M8G6APYYRzH0lmNXVabraH..', 'TRADER'),
    ('ops1',    '$2a$10$L9xqTqzfG/KPK1843GkEAu6FDY1ejqk1J5yPbMjM4NK2FpWhN6pJS', 'OPERATIONS'),
    ('risk1',   '$2a$10$QcGHEEqeHoGmrPPczgj0.O/P3iB7djnblpyDdJaCWg2zGG/VxEx6u', 'RISK_MANAGER');
