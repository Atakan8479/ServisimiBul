package com.servisimibul.backend.auth.exception;

public final class InvalidAuthTokenException extends RuntimeException {

    public InvalidAuthTokenException() {
        super("The token is invalid, expired, or already used");
    }
}
