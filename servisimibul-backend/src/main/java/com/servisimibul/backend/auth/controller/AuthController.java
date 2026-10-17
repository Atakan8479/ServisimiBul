package com.servisimibul.backend.auth.controller;

import com.servisimibul.backend.auth.dto.CsrfResponse;
import com.servisimibul.backend.auth.dto.CurrentUserResponse;
import com.servisimibul.backend.auth.dto.EmailRequest;
import com.servisimibul.backend.auth.dto.LoginRequest;
import com.servisimibul.backend.auth.dto.RegisterRequest;
import com.servisimibul.backend.auth.dto.ResetPasswordRequest;
import com.servisimibul.backend.auth.dto.TokenRequest;
import com.servisimibul.backend.auth.service.AuthService;
import com.servisimibul.backend.auth.service.SessionAuthenticationService;
import com.servisimibul.backend.auth.service.CurrentUserResponseFactory;
import com.servisimibul.backend.security.AuthenticatedUser;
import com.servisimibul.backend.security.ClientIdentityResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class AuthController {

    private final AuthService authService;
    private final SessionAuthenticationService sessionAuthenticationService;
    private final CurrentUserResponseFactory currentUserResponseFactory;
    private final ClientIdentityResolver clientIdentityResolver;

    @GetMapping("/csrf")
    CsrfResponse csrf(CsrfToken token) {
        return new CsrfResponse(token.getHeaderName(), token.getParameterName(), token.getToken());
    }

    @PostMapping("/register")
    ResponseEntity<Void> register(
            @Valid @RequestBody RegisterRequest request,
            HttpServletRequest httpRequest
    ) {
        authService.register(request, clientIdentityResolver.resolve(httpRequest));
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/verify-email")
    ResponseEntity<Void> verifyEmail(
            @Valid @RequestBody TokenRequest request,
            HttpServletRequest httpRequest
    ) {
        authService.verifyEmail(request, clientIdentityResolver.resolve(httpRequest));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/resend-verification")
    ResponseEntity<Void> resendVerification(
            @Valid @RequestBody EmailRequest request,
            HttpServletRequest httpRequest
    ) {
        authService.resendVerification(request, clientIdentityResolver.resolve(httpRequest));
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/forgot-password")
    ResponseEntity<Void> forgotPassword(
            @Valid @RequestBody EmailRequest request,
            HttpServletRequest httpRequest
    ) {
        authService.forgotPassword(request, clientIdentityResolver.resolve(httpRequest));
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/reset-password")
    ResponseEntity<Void> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request,
            HttpServletRequest httpRequest
    ) {
        authService.resetPassword(request, clientIdentityResolver.resolve(httpRequest));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/login")
    CurrentUserResponse login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse
    ) {
        return sessionAuthenticationService.login(
                request,
                clientIdentityResolver.resolve(httpRequest),
                httpRequest,
                httpResponse
        );
    }

    @GetMapping("/me")
    CurrentUserResponse me(@AuthenticationPrincipal AuthenticatedUser user) {
        return currentUserResponseFactory.create(user);
    }

    @PostMapping("/logout")
    ResponseEntity<Void> logout(HttpServletRequest request) {
        if (request.getSession(false) != null) {
            request.getSession(false).invalidate();
        }
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }

}
