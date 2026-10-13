package com.servisimibul.backend.auth;

final class AuthValidationException extends RuntimeException {

    private final String field;

    AuthValidationException(String field, String message) {
        super(message);
        this.field = field;
    }

    String field() {
        return field;
    }
}

final class InvalidAuthTokenException extends RuntimeException {

    InvalidAuthTokenException() {
        super("The token is invalid, expired, or already used");
    }
}

final class RateLimitExceededException extends RuntimeException {

    private final long retryAfterSeconds;

    RateLimitExceededException(long retryAfterSeconds) {
        super("Too many requests");
        this.retryAfterSeconds = retryAfterSeconds;
    }

    long retryAfterSeconds() {
        return retryAfterSeconds;
    }
}

final class EmailUnavailableException extends RuntimeException {

    EmailUnavailableException() {
        super("Email delivery is temporarily unavailable");
    }
}
