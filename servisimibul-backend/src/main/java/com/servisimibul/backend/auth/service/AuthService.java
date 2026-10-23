package com.servisimibul.backend.auth.service;

import com.servisimibul.backend.auth.config.EmailVerificationProperties;
import com.servisimibul.backend.auth.config.ParentEmailVerificationProperties;
import com.servisimibul.backend.auth.config.ParentRegistrationProperties;
import com.servisimibul.backend.auth.dto.EmailRequest;
import com.servisimibul.backend.auth.dto.ParentRegisterRequest;
import com.servisimibul.backend.auth.dto.RegisterRequest;
import com.servisimibul.backend.auth.dto.ResetPasswordRequest;
import com.servisimibul.backend.auth.dto.TokenRequest;
import com.servisimibul.backend.auth.exception.EmailUnavailableException;
import com.servisimibul.backend.auth.exception.ParentRegistrationUnavailableException;
import com.servisimibul.backend.security.SessionRevoker;
import com.servisimibul.backend.security.TokenHasher;
import com.servisimibul.backend.ratelimit.InMemoryRateLimiter;
import com.servisimibul.backend.ratelimit.RateLimitRule;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthInputValidator validator;
    private final EmailVerificationProperties emailVerification;
    private final ParentEmailVerificationProperties parentEmailVerification;
    private final ParentRegistrationProperties parentRegistration;
    private final AuthPersistenceService persistence;
    private final AuthEmailSender emailSender;
    private final InMemoryRateLimiter rateLimiter;
    private final TokenGenerator tokenGenerator;
    private final TokenHasher tokenHasher;
    private final SessionRevoker sessionRevoker;
    private final Clock clock;

    public void register(RegisterRequest request, String remoteAddress) {
        boolean verificationRequired = emailVerification.required();
        if (verificationRequired) {
            requireEmail();
        }
        String email = validator.email(request.email());
        String password = validator.password(request.password(), "password");
        String businessName = validator.businessName(request.businessName());
        String contactPhone = validator.phone(request.contactPhone());
        rateLimiter.requireAllowance(RateLimitRule.REGISTRATION_IP, remoteAddress);

        String rawToken = verificationRequired ? tokenGenerator.generate() : "";
        String tokenHash = verificationRequired ? tokenHasher.hash(rawToken) : "";
        boolean created;
        try {
            created = persistence.register(
                    email,
                    password,
                    businessName,
                    contactPhone,
                    tokenHash,
                    now()
            );
        } catch (DataIntegrityViolationException duplicateRegistration) {
            created = false;
        }
        if (created && verificationRequired) {
            safelySend(() -> emailSender.sendVerification(email, rawToken));
        }
    }

    public void registerParent(ParentRegisterRequest request, String remoteAddress) {
        if (!parentRegistration.enabled()
                || (parentEmailVerification.required() && !emailSender.isAvailable())) {
            throw new ParentRegistrationUnavailableException();
        }

        String email = validator.email(request.email());
        String password = validator.password(request.password(), "password");
        rateLimiter.requireAllowance(RateLimitRule.REGISTRATION_IP, remoteAddress);

        String rawToken = parentEmailVerification.required() ? tokenGenerator.generate() : null;
        boolean created;
        try {
            created = persistence.registerParent(
                    email,
                    password,
                    Optional.ofNullable(rawToken).map(tokenHasher::hash),
                    now()
            );
        } catch (DataIntegrityViolationException duplicateRegistration) {
            created = false;
        }
        if (created && rawToken != null) {
            safelySend(() -> emailSender.sendVerification(email, rawToken));
        }
    }

    public void resendVerification(EmailRequest request, String remoteAddress) {
        requireEmail();
        String email = validator.email(request.email());
        rateLimiter.requireAllowance(RateLimitRule.VERIFICATION_RESEND_IP, remoteAddress);

        String rawToken = tokenGenerator.generate();
        persistence.issueVerificationToken(email, tokenHasher.hash(rawToken), now())
                .ifPresent(recipient -> safelySend(
                        () -> emailSender.sendVerification(recipient, rawToken)
                ));
    }

    public void verifyEmail(TokenRequest request, String remoteAddress) {
        String token = request.token().strip();
        rateLimiter.requireAllowance(RateLimitRule.EMAIL_VERIFICATION_IP, remoteAddress);
        rateLimiter.requireAllowance(RateLimitRule.EMAIL_VERIFICATION_TOKEN, token);
        persistence.verifyEmail(tokenHasher.hash(token), now());
    }

    public void forgotPassword(EmailRequest request, String remoteAddress) {
        requireEmail();
        String email = validator.email(request.email());
        rateLimiter.requireAllowance(RateLimitRule.PASSWORD_RECOVERY_IP, remoteAddress);

        String rawToken = tokenGenerator.generate();
        persistence.issuePasswordResetToken(email, tokenHasher.hash(rawToken), now())
                .ifPresent(recipient -> safelySend(
                        () -> emailSender.sendPasswordReset(recipient, rawToken)
                ));
    }

    public void resetPassword(ResetPasswordRequest request, String remoteAddress) {
        String password = validator.password(request.newPassword(), "newPassword");
        String token = request.token().strip();
        rateLimiter.requireAllowance(RateLimitRule.PASSWORD_RESET_IP, remoteAddress);
        rateLimiter.requireAllowance(RateLimitRule.PASSWORD_RESET_TOKEN, token);
        UUID userId = persistence.resetPassword(
                tokenHasher.hash(token),
                password,
                now()
        );
        sessionRevoker.revokeAll(userId);
    }

    private void requireEmail() {
        if (!emailSender.isAvailable()) {
            throw new EmailUnavailableException();
        }
    }

    private OffsetDateTime now() {
        return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    private void safelySend(Runnable delivery) {
        try {
            delivery.run();
        } catch (RuntimeException deliveryFailure) {
            log.error("Authentication email delivery failed: {}", deliveryFailure.getClass().getSimpleName());
        }
    }
}
