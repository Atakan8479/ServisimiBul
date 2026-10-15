package com.servisimibul.backend.discovery.exception;

import org.springframework.http.HttpStatus;

import java.util.Map;

public final class PublicOperatorDiscoveryApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final Map<String, String> fieldErrors;

    private PublicOperatorDiscoveryApiException(
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

    public static PublicOperatorDiscoveryApiException notFound(String code, String detail) {
        return new PublicOperatorDiscoveryApiException(
                HttpStatus.NOT_FOUND,
                code,
                detail,
                Map.of()
        );
    }

    public static PublicOperatorDiscoveryApiException validation(String field, String message) {
        return new PublicOperatorDiscoveryApiException(
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
