package com.servisimibul.backend.operatorapproval;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;

@RestControllerAdvice
class OperatorAccessExceptionHandler {

    @ExceptionHandler(OperatorAccessException.class)
    ResponseEntity<ProblemDetail> handle(
            OperatorAccessException exception,
            HttpServletRequest request
    ) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                exception.status(),
                exception.getMessage()
        );
        problem.setTitle(exception.status().getReasonPhrase());
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("code", exception.code());
        return ResponseEntity.status(exception.status()).body(problem);
    }
}
