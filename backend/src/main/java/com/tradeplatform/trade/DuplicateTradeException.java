package com.tradeplatform.trade;

public class DuplicateTradeException extends RuntimeException {

    public DuplicateTradeException(String message) {
        super(message);
    }
}
