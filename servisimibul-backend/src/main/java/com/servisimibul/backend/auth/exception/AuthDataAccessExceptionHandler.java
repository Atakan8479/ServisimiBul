package com.servisimibul.backend.auth.exception;

import com.servisimibul.backend.auth.controller.AuthController;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;

/**
 * A session- or identity-store failure (for example, during global session revocation on
 * password change, password reset, or sign-out-all) must never surface as a false success and
 * must never leak internal exception details. Scoped to {@link AuthController} only, so other
 * controllers' data-access failures are unaffected.
 */
@Slf4j
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = AuthController.class)
class AuthDataAccessExceptionHandler {

    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<ProblemDetail> handleDataAccessFailure(
            DataAccessException exception,
            HttpServletRequest request
    ) {
        log.error("Authentication data access failure: {}", exception.getClass().getSimpleName());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.SERVICE_UNAVAILABLE,
                "The request could not be completed. Try again."
        );
        problem.setTitle("Authentication service unavailable");
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("code", "AUTH_SERVICE_UNAVAILABLE");
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(problem);
    }
}
