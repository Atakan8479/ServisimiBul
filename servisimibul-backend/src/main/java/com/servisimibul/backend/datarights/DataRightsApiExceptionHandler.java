package com.servisimibul.backend.datarights;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;

/** Rejected values are never echoed, so request text cannot leak through error bodies. */
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = {DataRightsController.class, AdminDataRightsController.class})
class DataRightsApiExceptionHandler {

    @ExceptionHandler(DataRightsApiException.class)
    ResponseEntity<ProblemDetail> handleApiException(DataRightsApiException exception, HttpServletRequest request) {
        return response(exception.status(), exception.code(), exception.getMessage(), exception.fieldErrors(), request);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ProblemDetail> handleValidation(
            MethodArgumentNotValidException exception,
            HttpServletRequest request
    ) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (FieldError fieldError : exception.getBindingResult().getFieldErrors()) {
            fieldErrors.putIfAbsent(fieldError.getField(), fieldError.getDefaultMessage());
        }
        return response(HttpStatus.BAD_REQUEST, "validation_error", "Request validation failed", fieldErrors, request);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ProblemDetail> handleMalformedRequest(HttpServletRequest request) {
        return response(HttpStatus.BAD_REQUEST, "malformed_request", "Request body is missing or malformed",
                Map.of(), request);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ProblemDetail> handleTypeMismatch(
            MethodArgumentTypeMismatchException exception,
            HttpServletRequest request
    ) {
        return response(HttpStatus.BAD_REQUEST, "invalid_parameter", "Request parameter has an invalid value",
                Map.of(exception.getName(), "has an invalid value"), request);
    }

    private ResponseEntity<ProblemDetail> response(
            HttpStatus status,
            String code,
            String detail,
            Map<String, String> fieldErrors,
            HttpServletRequest request
    ) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(status.getReasonPhrase());
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("code", code);
        if (!fieldErrors.isEmpty()) {
            problem.setProperty("fieldErrors", fieldErrors);
        }
        return ResponseEntity.status(status).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(problem);
    }
}
