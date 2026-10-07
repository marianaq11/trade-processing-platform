package com.tradeplatform.trade;

import java.math.BigDecimal;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record SubmitTradeRequest(
        @NotBlank @Size(max = 64) String clientTradeId,
        @NotBlank @Size(max = 20) String accountCode,
        @NotBlank @Size(max = 10) String symbol,
        @NotNull Side side,
        @NotNull @Positive @Max(10_000_000) Long quantity,
        // Capped so that max price x max quantity still fits the NUMERIC(19,4) notional column.
        @NotNull @Positive @Digits(integer = 7, fraction = 4) BigDecimal price) {
}
