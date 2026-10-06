package com.tradeplatform.trade;

import java.time.Instant;

public record TradeEventResponse(
        long id,
        TradeStatus fromStatus,
        TradeStatus toStatus,
        String detail,
        String performedBy,
        Instant createdAt) {

    static TradeEventResponse from(TradeEvent event) {
        return new TradeEventResponse(event.getId(), event.getFromStatus(), event.getToStatus(),
                event.getDetail(), event.getPerformedBy(), event.getCreatedAt());
    }
}
