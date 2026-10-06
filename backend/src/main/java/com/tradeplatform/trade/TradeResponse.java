package com.tradeplatform.trade;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record TradeResponse(
        long id,
        String clientTradeId,
        String accountCode,
        String symbol,
        Side side,
        long quantity,
        BigDecimal price,
        BigDecimal notional,
        LocalDate tradeDate,
        LocalDate settlementDate,
        TradeStatus status,
        RejectionReason rejectionReason,
        String rejectionDetail,
        String submittedBy,
        Instant createdAt,
        Instant updatedAt) {

    static TradeResponse from(Trade trade) {
        return new TradeResponse(
                trade.getId(),
                trade.getClientTradeId(),
                trade.getAccount().getCode(),
                trade.getInstrument().getSymbol(),
                trade.getSide(),
                trade.getQuantity(),
                trade.getPrice(),
                trade.getNotional(),
                trade.getTradeDate(),
                trade.getSettlementDate(),
                trade.getStatus(),
                trade.getRejectionReason(),
                trade.getRejectionDetail(),
                trade.getSubmittedBy(),
                trade.getCreatedAt(),
                trade.getUpdatedAt());
    }
}
