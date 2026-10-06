-- Demo data. Reference prices are made-up static values, not market data.

INSERT INTO account (code, name, status) VALUES
    ('ACC-1001', 'Harbor Growth Fund',     'ACTIVE'),
    ('ACC-1002', 'Lakeside Income Fund',   'ACTIVE'),
    ('ACC-1003', 'Summit Equity Partners', 'ACTIVE'),
    ('ACC-1004', 'Old Mill Capital',       'SUSPENDED');

INSERT INTO instrument (symbol, name, reference_price, active) VALUES
    ('AAPL',  'Apple Inc.',              230.0000, TRUE),
    ('MSFT',  'Microsoft Corp.',         450.0000, TRUE),
    ('AMZN',  'Amazon.com Inc.',         210.0000, TRUE),
    ('GOOGL', 'Alphabet Inc. Class A',   180.0000, TRUE),
    ('JPM',   'JPMorgan Chase & Co.',    250.0000, TRUE),
    ('NVDA',  'NVIDIA Corp.',            140.0000, TRUE),
    ('KO',    'Coca-Cola Co.',            70.0000, TRUE),
    ('XOM',   'Exxon Mobil Corp.',       115.0000, TRUE),
    ('BBBY',  'Bed Bath & Beyond Inc.',    0.1000, FALSE);
