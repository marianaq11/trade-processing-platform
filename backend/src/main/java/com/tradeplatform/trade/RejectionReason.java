package com.tradeplatform.trade;

public enum RejectionReason {
    // validation
    ACCOUNT_SUSPENDED,
    INSTRUMENT_INACTIVE,

    // risk
    NO_RISK_LIMITS,
    PRICE_OUT_OF_TOLERANCE,
    TRADE_NOTIONAL_LIMIT,
    DAILY_NOTIONAL_LIMIT
}
