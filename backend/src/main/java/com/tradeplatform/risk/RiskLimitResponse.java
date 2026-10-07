package com.tradeplatform.risk;

import java.math.BigDecimal;
import java.time.Instant;

import com.tradeplatform.account.Account;
import com.tradeplatform.account.AccountStatus;

// The limit fields are null for an account that has no limits set up yet.
public record RiskLimitResponse(
        String accountCode,
        String accountName,
        AccountStatus accountStatus,
        BigDecimal maxTradeNotional,
        BigDecimal maxDailyNotional,
        BigDecimal priceTolerancePct,
        BigDecimal usedToday,
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
