package com.servisimibul.backend.security;

import tools.jackson.databind.ObjectMapper;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.HttpStatusCode;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;

@Component
@RequiredArgsConstructor
final class RestSecurityErrorHandler implements AuthenticationEntryPoint, AccessDeniedHandler {

    private final ObjectMapper objectMapper;

    @Override
    public void commence(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException exception
    ) throws IOException {
        write(
                request,
                response,
                HttpServletResponse.SC_UNAUTHORIZED,
                "Authentication required",
                "Authentication is required to access this resource",
                "AUTHENTICATION_REQUIRED"
        );
    }

    @Override
    public void handle(
            HttpServletRequest request,
            HttpServletResponse response,
            AccessDeniedException exception
    ) throws IOException, ServletException {
        boolean csrfRejected = exception instanceof CsrfException;
        write(
                request,
                response,
                HttpServletResponse.SC_FORBIDDEN,
                csrfRejected ? "CSRF validation failed" : "Access denied",
                csrfRejected
                        ? "A valid CSRF token is required"
                        : "The authenticated identity is not authorized for this resource",
                csrfRejected ? "CSRF_INVALID" : "ACCESS_DENIED"
        );
    }

    private void write(
            HttpServletRequest request,
            HttpServletResponse response,
            int status,
            String title,
            String detail,
            String code
    ) throws IOException {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatusCode.valueOf(status),
                detail
        );
        problem.setTitle(title);
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("code", code);
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), problem);
    }
}
