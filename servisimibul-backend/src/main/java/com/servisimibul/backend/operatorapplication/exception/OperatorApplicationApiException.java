package com.servisimibul.backend.operatorapplication.exception;

import org.springframework.http.HttpStatus;

import java.util.Map;

public final class OperatorApplicationApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final Map<String, String> fieldErrors;

    private OperatorApplicationApiException(
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

    public static OperatorApplicationApiException notFound(String code, String detail) {
        return new OperatorApplicationApiException(HttpStatus.NOT_FOUND, code, detail, Map.of());
    }

    public static OperatorApplicationApiException forbidden(String code, String detail) {
        return new OperatorApplicationApiException(HttpStatus.FORBIDDEN, code, detail, Map.of());
    }

    public static OperatorApplicationApiException conflict(String code, String detail) {
        return new OperatorApplicationApiException(HttpStatus.CONFLICT, code, detail, Map.of());
    }

    public static OperatorApplicationApiException validation(String field, String message) {
        return new OperatorApplicationApiException(
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
