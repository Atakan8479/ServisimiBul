package com.servisimibul.backend.demand.exception;

import org.springframework.http.HttpStatus;

import java.util.Map;

public final class DemandApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final Map<String, String> fieldErrors;

    private DemandApiException(
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

    public static DemandApiException notFound(String code, String detail) {
        return new DemandApiException(HttpStatus.NOT_FOUND, code, detail, Map.of());
    }

    public static DemandApiException conflict(String code, String detail) {
        return new DemandApiException(HttpStatus.CONFLICT, code, detail, Map.of());
    }

    public static DemandApiException forbidden(String code, String detail) {
        return new DemandApiException(HttpStatus.FORBIDDEN, code, detail, Map.of());
    }

    public static DemandApiException validation(String field, String message) {
        return new DemandApiException(
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
