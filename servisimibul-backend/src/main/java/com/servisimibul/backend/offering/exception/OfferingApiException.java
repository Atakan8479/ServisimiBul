package com.servisimibul.backend.offering.exception;

import org.springframework.http.HttpStatus;

import java.util.Map;

public final class OfferingApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final Map<String, String> fieldErrors;

    private OfferingApiException(
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

    public static OfferingApiException notFound(String code, String detail) {
        return new OfferingApiException(HttpStatus.NOT_FOUND, code, detail, Map.of());
    }

    public static OfferingApiException conflict(String code, String detail) {
        return new OfferingApiException(HttpStatus.CONFLICT, code, detail, Map.of());
    }

    public static OfferingApiException validation(String field, String message) {
        return new OfferingApiException(
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
