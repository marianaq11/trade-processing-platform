package com.tradeplatform.common;

// For access rules that depend on data (like account entitlements) rather than on role,
// which SecurityConfig already covers.
public class ForbiddenException extends RuntimeException {

    public ForbiddenException(String message) {
        super(message);
    }
}
