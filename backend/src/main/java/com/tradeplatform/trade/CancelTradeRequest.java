package com.tradeplatform.trade;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CancelTradeRequest(@NotBlank @Size(max = 255) String reason) {
}
