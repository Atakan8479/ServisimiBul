package com.servisimibul.backend.auth.service;

import com.servisimibul.backend.auth.config.AccountDeactivationProperties;
import com.servisimibul.backend.auth.config.EmailVerificationProperties;
import com.servisimibul.backend.auth.config.EmailChangeProperties;
import com.servisimibul.backend.auth.config.ParentEmailVerificationProperties;
import com.servisimibul.backend.auth.config.ParentRegistrationProperties;
import com.servisimibul.backend.auth.dto.ChangePasswordRequest;
import com.servisimibul.backend.auth.dto.EmailRequest;
import com.servisimibul.backend.auth.dto.EmailChangeRequest;
import com.servisimibul.backend.auth.dto.ParentRegisterRequest;
import com.servisimibul.backend.auth.dto.RegisterRequest;
import com.servisimibul.backend.auth.dto.ResetPasswordRequest;
import com.servisimibul.backend.auth.dto.TokenRequest;
import com.servisimibul.backend.auth.exception.AccountDeactivationUnavailableException;
import com.servisimibul.backend.auth.exception.EmailUnavailableException;
import com.servisimibul.backend.auth.exception.InvalidAuthTokenException;
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
    private final EmailChangeProperties emailChange;
    private final ParentEmailVerificationProperties parentEmailVerification;
    private final ParentRegistrationProperties parentRegistration;
    private final AccountDeactivationProperties accountDeactivation;
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

    public void changePassword(ChangePasswordRequest request, UUID userId, String remoteAddress) {
        String currentPassword = validator.password(request.currentPassword(), "currentPassword");
        String newPassword = validator.password(request.newPassword(), "newPassword");
        rateLimiter.requireAllowance(RateLimitRule.PASSWORD_CHANGE_IP, remoteAddress);
        rateLimiter.requireAllowance(RateLimitRule.PASSWORD_CHANGE_ACCOUNT, userId.toString());
        persistence.changePassword(userId, currentPassword, newPassword);
        sessionRevoker.revokeAll(userId);
    }

    public void logoutAll(UUID userId) {
        sessionRevoker.revokeAll(userId);
    }

    public void deactivateAccount(UUID userId) {
        if (!accountDeactivation.enabled()) {
            throw new AccountDeactivationUnavailableException();
        }
        // Revoke sessions before persisting the restriction: if the session store fails, the
        // account must never end up deactivated with a still-usable stale session (see the
        // session-revocation-failure cases in AccountDeactivationApiTests). A later persistence
        // failure instead leaves sessions revoked but the account not marked deactivated, which
        // is the same safe direction logout-all already fails in.
        sessionRevoker.revokeAll(userId);
        persistence.deactivateAccount(userId, now());
    }

    public boolean isAccountDeactivationAvailable() {
        return accountDeactivation.enabled();
    }

    public void requestEmailChange(EmailChangeRequest request, UUID userId, String remoteAddress) {
        requireEmailChange();
        String proposedEmail = validator.email(request.email());
        rateLimiter.requireAllowance(RateLimitRule.EMAIL_CHANGE_IP, remoteAddress);
        rateLimiter.requireAllowance(RateLimitRule.EMAIL_CHANGE_ACCOUNT, userId.toString());

        String rawToken = tokenGenerator.generate();
        String tokenHash = tokenHasher.hash(rawToken);
        boolean issued;
        try {
            issued = persistence.issueEmailChange(userId, proposedEmail, tokenHash, now());
        } catch (DataIntegrityViolationException conflict) {
            issued = false;
        }
        if (!issued) {
            return;
        }

        try {
            emailSender.sendEmailChangeVerification(proposedEmail, rawToken);
        } catch (RuntimeException deliveryFailure) {
            log.error("Email change delivery failed: {}", deliveryFailure.getClass().getSimpleName());
            persistence.invalidateEmailChange(tokenHash, now());
        }
    }

    public void confirmEmailChange(TokenRequest request, String remoteAddress) {
        requireEmailChange();
        String token = request.token().strip();
        rateLimiter.requireAllowance(RateLimitRule.EMAIL_CHANGE_CONFIRM_IP, remoteAddress);
        rateLimiter.requireAllowance(RateLimitRule.EMAIL_CHANGE_CONFIRM_TOKEN, token);
        AuthPersistenceService.ConfirmedEmailChange confirmed;
        try {
            confirmed = persistence.confirmEmailChange(tokenHasher.hash(token), now())
                    .orElseThrow(InvalidAuthTokenException::new);
        } catch (DataIntegrityViolationException conflict) {
            throw new InvalidAuthTokenException();
        }
        sessionRevoker.revokeAll(confirmed.oldEmail());
    }

    boolean isEmailChangeAvailable() {
        return emailChange.enabled() && emailSender.isAvailable();
    }

    private void requireEmail() {
        if (!emailSender.isAvailable()) {
            throw new EmailUnavailableException();
        }
    }

    private void requireEmailChange() {
        if (!isEmailChangeAvailable()) {
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
