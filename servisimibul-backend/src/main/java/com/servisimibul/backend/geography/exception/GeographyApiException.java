package com.servisimibul.backend.geography.exception;

import org.springframework.http.HttpStatus;

import java.util.Map;

public final class GeographyApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final Map<String, String> fieldErrors;

    private GeographyApiException(
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

    public static GeographyApiException notFound(String code, String detail) {
        return new GeographyApiException(HttpStatus.NOT_FOUND, code, detail, Map.of());
    }

    public static GeographyApiException conflict(String code, String detail) {
        return new GeographyApiException(HttpStatus.CONFLICT, code, detail, Map.of());
    }

    public static GeographyApiException validation(String field, String message) {
        return new GeographyApiException(
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
