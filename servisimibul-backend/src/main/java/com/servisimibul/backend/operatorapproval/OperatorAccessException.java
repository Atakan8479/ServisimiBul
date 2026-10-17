package com.servisimibul.backend.operatorapproval;

import org.springframework.http.HttpStatus;

public final class OperatorAccessException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    private OperatorAccessException(HttpStatus status, String code, String detail) {
        super(detail);
        this.status = status;
        this.code = code;
    }

    static OperatorAccessException forbidden(String code, String detail) {
        return new OperatorAccessException(HttpStatus.FORBIDDEN, code, detail);
    }

    static OperatorAccessException conflict(String code, String detail) {
        return new OperatorAccessException(HttpStatus.CONFLICT, code, detail);
    }

    HttpStatus status() {
        return status;
    }

    String code() {
        return code;
    }
}
