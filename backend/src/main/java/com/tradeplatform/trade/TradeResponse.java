package com.tradeplatform.trade;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonFormat;

// Notional is sent as a string ("99999989900000.0100"). It can have 14 integer digits and 4
// decimal places, more than a JS number holds, so as a JSON number the browser would lose cents.
public record TradeResponse(
        long id,
        String clientTradeId,
        String accountCode,
        String accountName,
        String symbol,
        String instrumentName,
        Side side,
        long quantity,
        BigDecimal price,
        @JsonFormat(shape = JsonFormat.Shape.STRING) BigDecimal notional,
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
                trade.getAccount().getName(),
                trade.getInstrument().getSymbol(),
                trade.getInstrument().getName(),
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
