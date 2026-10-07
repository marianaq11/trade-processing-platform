package com.tradeplatform.common;

// For validation that needs more than one field (or the database) to decide, so it can't be
// a Bean Validation annotation. Comes back in the same "errors" format as annotation failures.
public class InvalidFieldException extends RuntimeException {

    private final String field;

    public InvalidFieldException(String field, String message) {
        super(message);
        this.field = field;
    }

    public String getField() {
        return field;
    }
}
