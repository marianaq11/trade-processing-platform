package com.tradeplatform.risk;

import java.math.BigDecimal;
import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonFormat;

// Values are strings for the same reason as in RiskLimitResponse.
public record RiskLimitChangeResponse(
        long id,
        String accountCode,
        RiskLimitField field,
        @JsonFormat(shape = JsonFormat.Shape.STRING) BigDecimal oldValue,
        @JsonFormat(shape = JsonFormat.Shape.STRING) BigDecimal newValue,
        String reason,
        String changedBy,
        Instant changedAt) {

    static RiskLimitChangeResponse from(RiskLimitChange change) {
        return new RiskLimitChangeResponse(change.getId(), change.getAccount().getCode(), change.getField(),
                change.getOldValue(), change.getNewValue(), change.getReason(), change.getChangedBy(),
                change.getChangedAt());
    }
}
