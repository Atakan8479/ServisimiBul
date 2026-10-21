package com.servisimibul.backend.demand.comment.exception;

import org.springframework.http.HttpStatus;

import java.util.Map;

public final class DemandCommentApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final Map<String, String> fieldErrors;

    private DemandCommentApiException(
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

    public static DemandCommentApiException notFound(String code, String detail) {
        return new DemandCommentApiException(HttpStatus.NOT_FOUND, code, detail, Map.of());
    }

    public static DemandCommentApiException forbidden(String code, String detail) {
        return new DemandCommentApiException(HttpStatus.FORBIDDEN, code, detail, Map.of());
    }

    public static DemandCommentApiException conflict(String code, String detail) {
        return new DemandCommentApiException(HttpStatus.CONFLICT, code, detail, Map.of());
    }

    public static DemandCommentApiException validation(String field, String message) {
        return new DemandCommentApiException(
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
