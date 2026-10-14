package com.servisimibul.backend.auth.exception;

public final class EmailUnavailableException extends RuntimeException {

    public EmailUnavailableException() {
        super("Email delivery is temporarily unavailable");
    }
}
