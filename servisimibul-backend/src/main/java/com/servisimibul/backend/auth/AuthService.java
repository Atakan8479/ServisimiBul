package com.servisimibul.backend.auth;

import com.servisimibul.backend.security.SessionRevoker;
import com.servisimibul.backend.security.TokenHasher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
class AuthService {

    private static final Duration IP_LIMIT_WINDOW = Duration.ofHours(1);
    private static final int IP_LIMIT = 20;

    private final AuthInputValidator validator;
    private final AuthPersistenceService persistence;
    private final AuthEmailSender emailSender;
    private final AuthRateLimiter rateLimiter;
    private final TokenGenerator tokenGenerator;
    private final TokenHasher tokenHasher;
    private final SessionRevoker sessionRevoker;
    private final Clock clock;

    void register(RegisterRequest request, String remoteAddress) {
        requireEmail();
        String email = validator.email(request.email());
        String password = validator.password(request.password(), "password");
        String businessName = validator.businessName(request.businessName());
        String contactPhone = validator.phone(request.contactPhone());
        requireIpAllowance("register", remoteAddress);

        String rawToken = tokenGenerator.generate();
        boolean created;
        try {
            created = persistence.register(
                    email,
                    password,
                    businessName,
                    contactPhone,
                    tokenHasher.hash(rawToken),
                    now()
            );
        } catch (DataIntegrityViolationException duplicateRegistration) {
            created = false;
        }
        if (created) {
            safelySend(() -> emailSender.sendVerification(email, rawToken));
        }
    }

    void resendVerification(EmailRequest request, String remoteAddress) {
        requireEmail();
        String email = validator.email(request.email());
        requireIpAllowance("resend", remoteAddress);

        String rawToken = tokenGenerator.generate();
        persistence.issueVerificationToken(email, tokenHasher.hash(rawToken), now())
                .ifPresent(recipient -> safelySend(
                        () -> emailSender.sendVerification(recipient, rawToken)
                ));
    }

    void verifyEmail(TokenRequest request) {
        persistence.verifyEmail(tokenHasher.hash(request.token().strip()), now());
    }

    void forgotPassword(EmailRequest request, String remoteAddress) {
        requireEmail();
        String email = validator.email(request.email());
        requireIpAllowance("forgot", remoteAddress);

        String rawToken = tokenGenerator.generate();
        persistence.issuePasswordResetToken(email, tokenHasher.hash(rawToken), now())
                .ifPresent(recipient -> safelySend(
                        () -> emailSender.sendPasswordReset(recipient, rawToken)
                ));
    }

    void resetPassword(ResetPasswordRequest request) {
        String password = validator.password(request.newPassword(), "newPassword");
        UUID userId = persistence.resetPassword(
                tokenHasher.hash(request.token().strip()),
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

    private void requireIpAllowance(String action, String remoteAddress) {
        rateLimiter.requireAllowance(
                action + ":ip:" + remoteAddress,
                IP_LIMIT,
                IP_LIMIT_WINDOW,
                clock.instant()
        );
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
