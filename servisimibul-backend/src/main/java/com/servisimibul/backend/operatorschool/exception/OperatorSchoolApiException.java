package com.servisimibul.backend.operatorschool.exception;

import org.springframework.http.HttpStatus;

import java.util.Map;

public final class OperatorSchoolApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final Map<String, String> fieldErrors;

    private OperatorSchoolApiException(
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

    public static OperatorSchoolApiException notFound(String code, String detail) {
        return new OperatorSchoolApiException(HttpStatus.NOT_FOUND, code, detail, Map.of());
    }

    public static OperatorSchoolApiException conflict(String code, String detail) {
        return new OperatorSchoolApiException(HttpStatus.CONFLICT, code, detail, Map.of());
    }

    public static OperatorSchoolApiException validation(String code, String field, String message) {
        return new OperatorSchoolApiException(
                HttpStatus.BAD_REQUEST,
                code,
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
