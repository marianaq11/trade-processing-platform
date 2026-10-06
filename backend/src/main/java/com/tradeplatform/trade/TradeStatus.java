package com.tradeplatform.trade;

public enum TradeStatus {
    RECEIVED,
    VALIDATED,
    ACCEPTED,
    REJECTED,
    CANCELLED,
    SETTLED;

    public boolean canTransitionTo(TradeStatus next) {
        return switch (this) {
            case RECEIVED -> next == VALIDATED || next == REJECTED;
            case VALIDATED -> next == ACCEPTED || next == REJECTED;
            case ACCEPTED -> next == CANCELLED || next == SETTLED;
            case REJECTED, CANCELLED, SETTLED -> false;
        };
    }
}
