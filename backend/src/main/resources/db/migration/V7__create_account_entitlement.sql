-- Which accounts each trader may book trades on. Operations and risk managers don't book
-- trades, so they have no rows here.
CREATE TABLE account_entitlement (
    user_id    BIGINT NOT NULL REFERENCES app_user (id),
    account_id BIGINT NOT NULL REFERENCES account (id),
    PRIMARY KEY (user_id, account_id)
);

-- Demo entitlements: both traders share ACC-1002 and the suspended ACC-1004, and each has one
-- account the other can't use (ACC-1001 for trader1, ACC-1003 for trader2).
INSERT INTO account_entitlement (user_id, account_id)
SELECT u.id, a.id
FROM (VALUES ('trader1', 'ACC-1001'),
             ('trader1', 'ACC-1002'),
             ('trader1', 'ACC-1004'),
             ('trader2', 'ACC-1002'),
             ('trader2', 'ACC-1003'),
             ('trader2', 'ACC-1004')) AS e (username, code)
JOIN app_user u ON u.username = e.username
JOIN account a ON a.code = e.code;
