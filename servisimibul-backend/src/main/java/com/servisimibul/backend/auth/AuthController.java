package com.servisimibul.backend.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    ResponseEntity<Void> register(
            @Valid @RequestBody RegisterRequest request,
            HttpServletRequest httpRequest
    ) {
        authService.register(request, remoteAddress(httpRequest));
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/verify-email")
    ResponseEntity<Void> verifyEmail(@Valid @RequestBody TokenRequest request) {
        authService.verifyEmail(request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/resend-verification")
    ResponseEntity<Void> resendVerification(
            @Valid @RequestBody EmailRequest request,
            HttpServletRequest httpRequest
    ) {
        authService.resendVerification(request, remoteAddress(httpRequest));
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/forgot-password")
    ResponseEntity<Void> forgotPassword(
            @Valid @RequestBody EmailRequest request,
            HttpServletRequest httpRequest
    ) {
        authService.forgotPassword(request, remoteAddress(httpRequest));
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/reset-password")
    ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ResponseEntity.noContent().build();
    }

    private String remoteAddress(HttpServletRequest request) {
        // shortcut: use the servlet peer address until a trusted reverse-proxy policy is configured.
        return request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
    }
}
