package com.tradeplatform.risk;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

// version is the one the client loaded; null when the account has no limits yet.
public record UpdateRiskLimitsRequest(
        @NotNull(message = "Required")
        @DecimalMin(value = "0.01", message = "Must be greater than 0")
        @Digits(integer = 15, fraction = 2, message = "Use at most 15 digits and 2 decimal places")
        BigDecimal maxTradeNotional,

        @NotNull(message = "Required")
        @DecimalMin(value = "0.01", message = "Must be greater than 0")
        @Digits(integer = 15, fraction = 2, message = "Use at most 15 digits and 2 decimal places")
        BigDecimal maxDailyNotional,

        @NotNull(message = "Required")
        @DecimalMin(value = "0.01", message = "Must be greater than 0")
        @DecimalMax(value = "100", message = "Can't be more than 100%")
        @Digits(integer = 3, fraction = 2, message = "Use at most 2 decimal places")
        BigDecimal priceTolerancePct,

        @NotBlank(message = "Give a reason for the change")
        @Size(max = 255, message = "Keep the reason under 255 characters")
        String reason,

        Long version) {

    BigDecimal get(RiskLimitField field) {
        return switch (field) {
            case MAX_TRADE_NOTIONAL -> maxTradeNotional;
            case MAX_DAILY_NOTIONAL -> maxDailyNotional;
            case PRICE_TOLERANCE_PCT -> priceTolerancePct;
        };
    }
}
