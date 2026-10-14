package com.servisimibul.backend.auth.exception;

public final class AuthValidationException extends RuntimeException {

    private final String field;

    public AuthValidationException(String field, String message) {
        super(message);
        this.field = field;
    }

    public String field() {
        return field;
    }
}
