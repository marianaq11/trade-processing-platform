package com.tradeplatform.risk;

import java.math.BigDecimal;
import java.time.Instant;

public record RiskLimitChangeResponse(
        long id,
        String accountCode,
        RiskLimitField field,
        BigDecimal oldValue,
        BigDecimal newValue,
        String reason,
        String changedBy,
        Instant changedAt) {

    static RiskLimitChangeResponse from(RiskLimitChange change) {
        return new RiskLimitChangeResponse(change.getId(), change.getAccount().getCode(), change.getField(),
                change.getOldValue(), change.getNewValue(), change.getReason(), change.getChangedBy(),
                change.getChangedAt());
    }
}
