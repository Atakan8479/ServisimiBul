package com.servisimibul.backend.auth.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.http.converter.HttpMessageNotReadableException;

import java.net.URI;
import java.util.List;
import java.util.Map;

@RestControllerAdvice
class ApiExceptionHandler {

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ProblemDetail> handleMalformedJson(
            HttpServletRequest request
    ) {
        return ResponseEntity.badRequest().body(problem(
                HttpStatus.BAD_REQUEST,
                "Malformed JSON",
                "Request body is not valid JSON",
                "MALFORMED_JSON",
                request
        ));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ProblemDetail> handleBeanValidation(
            MethodArgumentNotValidException exception,
            HttpServletRequest request
    ) {
        List<Map<String, String>> fieldErrors = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> Map.of(
                        "field", error.getField(),
                        "message", error.getDefaultMessage() == null ? "Invalid value" : error.getDefaultMessage()
                ))
                .toList();
        ProblemDetail problem = problem(
                HttpStatus.BAD_REQUEST,
                "Validation failed",
                "One or more request fields are invalid",
                "VALIDATION_FAILED",
                request
        );
        problem.setProperty("fieldErrors", fieldErrors);
        return ResponseEntity.badRequest().body(problem);
    }

    @ExceptionHandler(AuthValidationException.class)
    ResponseEntity<ProblemDetail> handleAuthValidation(
            AuthValidationException exception,
            HttpServletRequest request
    ) {
        ProblemDetail problem = problem(
                HttpStatus.BAD_REQUEST,
                "Validation failed",
                "One or more request fields are invalid",
                "VALIDATION_FAILED",
                request
        );
        problem.setProperty("fieldErrors", List.of(Map.of(
                "field", exception.field(),
                "message", exception.getMessage()
        )));
        return ResponseEntity.badRequest().body(problem);
    }

    @ExceptionHandler(InvalidAuthTokenException.class)
    ResponseEntity<ProblemDetail> handleInvalidToken(
            InvalidAuthTokenException exception,
            HttpServletRequest request
    ) {
        return ResponseEntity.badRequest().body(problem(
                HttpStatus.BAD_REQUEST,
                "Invalid token",
                exception.getMessage(),
                "TOKEN_INVALID_OR_EXPIRED",
                request
        ));
    }

    @ExceptionHandler(RateLimitExceededException.class)
    ResponseEntity<ProblemDetail> handleRateLimit(
            RateLimitExceededException exception,
            HttpServletRequest request
    ) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, Long.toString(exception.retryAfterSeconds()))
                .body(problem(
                        HttpStatus.TOO_MANY_REQUESTS,
                        "Too many requests",
                        "Try again later",
                        "RATE_LIMITED",
                        request
                ));
    }

    @ExceptionHandler(EmailUnavailableException.class)
    ResponseEntity<ProblemDetail> handleEmailUnavailable(
            EmailUnavailableException exception,
            HttpServletRequest request
    ) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(problem(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Email unavailable",
                exception.getMessage(),
                "EMAIL_UNAVAILABLE",
                request
        ));
    }

    @ExceptionHandler(ParentRegistrationUnavailableException.class)
    ResponseEntity<ProblemDetail> handleParentRegistrationUnavailable(
            ParentRegistrationUnavailableException exception,
            HttpServletRequest request
    ) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(problem(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Parent registration unavailable",
                exception.getMessage(),
                "PARENT_REGISTRATION_UNAVAILABLE",
                request
        ));
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    ResponseEntity<ProblemDetail> handleInvalidCredentials(
            InvalidCredentialsException exception,
            HttpServletRequest request
    ) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(problem(
                HttpStatus.UNAUTHORIZED,
                "Authentication failed",
                exception.getMessage(),
                "INVALID_CREDENTIALS",
                request
        ));
    }

    private ProblemDetail problem(
            HttpStatus status,
            String title,
            String detail,
            String code,
            HttpServletRequest request
    ) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(title);
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("code", code);
        return problem;
    }
}
