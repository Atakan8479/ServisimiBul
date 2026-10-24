package com.servisimibul.backend.moderation.exception;

import org.springframework.http.HttpStatus;

import java.util.Map;

public final class ModerationApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final Map<String, String> fieldErrors;

    private ModerationApiException(
            HttpStatus status,
            String code,
            String detail,
            Map<String, String> fieldErrors
    ) {
        super(detail);
        this.status = status;
        this.code = code;
        this.fieldErrors = Map.copyOf(fieldErrors);
    }

    public static ModerationApiException notFound(String code, String detail) {
        return new ModerationApiException(HttpStatus.NOT_FOUND, code, detail, Map.of());
    }

    public static ModerationApiException forbidden(String code, String detail) {
        return new ModerationApiException(HttpStatus.FORBIDDEN, code, detail, Map.of());
    }

    public static ModerationApiException conflict(String code, String detail) {
        return new ModerationApiException(HttpStatus.CONFLICT, code, detail, Map.of());
    }

    public static ModerationApiException validation(String field, String message) {
        return new ModerationApiException(
                HttpStatus.BAD_REQUEST,
                "validation_error",
                "Request validation failed",
                Map.of(field, message)
        );
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }

    public Map<String, String> fieldErrors() {
        return fieldErrors;
    }
}
