package com.servisimibul.backend.tariff.exception;

import org.springframework.http.HttpStatus;

import java.util.Map;

public final class TariffApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final Map<String, String> fieldErrors;

    private TariffApiException(
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

    public static TariffApiException validation(Map<String, String> fieldErrors) {
        return new TariffApiException(
                HttpStatus.BAD_REQUEST,
                "validation_error",
                "Tariff validation failed",
                fieldErrors
        );
    }

    public static TariffApiException notFound(String provinceCode) {
        return new TariffApiException(
                HttpStatus.NOT_FOUND,
                "tariff_not_found",
                "No current tariff exists for province " + provinceCode,
                Map.of()
        );
    }

    public static TariffApiException versionConflict() {
        return new TariffApiException(
                HttpStatus.CONFLICT,
                "tariff_version_conflict",
                "The tariff has changed since it was read",
                Map.of()
        );
    }

    public static TariffApiException storageUnavailable() {
        return new TariffApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "tariff_storage_unavailable",
                "Tariff storage is unavailable",
                Map.of()
        );
    }

    public static TariffApiException invalidStoredDocument() {
        return new TariffApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "tariff_storage_invalid",
                "The current tariff document is invalid",
                Map.of()
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
