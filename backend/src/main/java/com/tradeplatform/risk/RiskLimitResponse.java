package com.tradeplatform.risk;

import java.math.BigDecimal;
import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.tradeplatform.account.Account;
import com.tradeplatform.account.AccountStatus;

// The limit fields are null for an account that has no limits set up yet. Amounts are sent as
// strings ("99999999999999.99"); as JSON numbers the browser would round the largest ones.
public record RiskLimitResponse(
        String accountCode,
        String accountName,
        AccountStatus accountStatus,
        @JsonFormat(shape = JsonFormat.Shape.STRING) BigDecimal maxTradeNotional,
        @JsonFormat(shape = JsonFormat.Shape.STRING) BigDecimal maxDailyNotional,
        @JsonFormat(shape = JsonFormat.Shape.STRING) BigDecimal priceTolerancePct,
        @JsonFormat(shape = JsonFormat.Shape.STRING) BigDecimal usedToday,
        Instant updatedAt,
        String updatedBy,
        Long version) {

    static RiskLimitResponse from(Account account, RiskLimit limit, BigDecimal usedToday) {
        if (limit == null) {
            return new RiskLimitResponse(account.getCode(), account.getName(), account.getStatus(),
                    null, null, null, usedToday, null, null, null);
        }
        return new RiskLimitResponse(account.getCode(), account.getName(), account.getStatus(),
                limit.getMaxTradeNotional(), limit.getMaxDailyNotional(), limit.getPriceTolerancePct(),
                usedToday, limit.getUpdatedAt(), limit.getUpdatedBy(), limit.getVersion());
    }
}
