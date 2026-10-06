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
        @NotBlank String accountCode,
        @NotBlank String symbol,
        @NotNull Side side,
        @NotNull @Positive @Max(10_000_000) Long quantity,
        @NotNull @Positive @Digits(integer = 15, fraction = 4) BigDecimal price) {
}
