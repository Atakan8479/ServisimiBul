package com.servisimibul.backend.datarights;

import org.springframework.http.HttpStatus;

import java.util.Map;

/** Messages are fixed text; never include request details, notes or account identifiers. */
public final class DataRightsApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final Map<String, String> fieldErrors;

    private DataRightsApiException(HttpStatus status, String code, String detail, Map<String, String> fieldErrors) {
        super(detail, null, false, false);
        this.status = status;
        this.code = code;
        this.fieldErrors = Map.copyOf(fieldErrors);
    }

    static DataRightsApiException unavailable() {
        return new DataRightsApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "data_rights_unavailable",
                "Data rights requests are not available yet",
                Map.of()
        );
    }

    static DataRightsApiException notFound() {
        return new DataRightsApiException(
                HttpStatus.NOT_FOUND, "request_not_found", "Request was not found", Map.of());
    }

    static DataRightsApiException forbidden(String code, String detail) {
        return new DataRightsApiException(HttpStatus.FORBIDDEN, code, detail, Map.of());
    }

    static DataRightsApiException conflict(String code, String detail) {
        return new DataRightsApiException(HttpStatus.CONFLICT, code, detail, Map.of());
    }

    static DataRightsApiException validation(String field, String message) {
        return new DataRightsApiException(
                HttpStatus.BAD_REQUEST, "validation_error", "Request validation failed", Map.of(field, message));
    }

    HttpStatus status() {
        return status;
    }

    String code() {
        return code;
    }

    Map<String, String> fieldErrors() {
        return fieldErrors;
    }
}
