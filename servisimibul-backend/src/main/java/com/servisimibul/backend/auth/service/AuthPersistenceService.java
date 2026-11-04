package com.servisimibul.backend.auth.service;

import com.servisimibul.backend.auth.config.EmailVerificationProperties;
import com.servisimibul.backend.auth.exception.AuthValidationException;
import com.servisimibul.backend.auth.exception.InvalidAuthTokenException;
import com.servisimibul.backend.auth.exception.InvalidCurrentPasswordException;
import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import com.servisimibul.backend.identity.EmailVerificationToken;
import com.servisimibul.backend.identity.EmailVerificationTokenRepository;
import com.servisimibul.backend.identity.OperatorProfile;
import com.servisimibul.backend.identity.OperatorProfileRepository;
import com.servisimibul.backend.identity.PasswordResetToken;
import com.servisimibul.backend.identity.PasswordResetTokenRepository;
import com.servisimibul.backend.identity.PendingEmailChange;
import com.servisimibul.backend.identity.PendingEmailChangeRepository;
import com.servisimibul.backend.ratelimit.InMemoryRateLimiter;
import com.servisimibul.backend.ratelimit.RateLimitRule;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
class AuthPersistenceService {

    private static final Duration TOKEN_COOLDOWN = Duration.ofSeconds(60);
    private final AppUserRepository userRepository;
    private final EmailVerificationProperties emailVerification;
    private final OperatorProfileRepository profileRepository;
    private final EmailVerificationTokenRepository verificationTokenRepository;
    private final PasswordResetTokenRepository resetTokenRepository;
    private final PendingEmailChangeRepository pendingEmailChangeRepository;
    private final PasswordEncoder passwordEncoder;
    private final InMemoryRateLimiter rateLimiter;

    boolean register(
            String email,
            String password,
            String businessName,
            String contactPhone,
            String tokenHash,
            OffsetDateTime now
    ) {
        String passwordHash = passwordEncoder.encode(password);
        if (userRepository.findByEmail(email).isPresent()) {
            return false;
        }

        AppUser user = userRepository.save(AppUser.newOperator(email, passwordHash));
        profileRepository.save(new OperatorProfile(user, businessName, contactPhone));
        if (emailVerification.required()) {
            verificationTokenRepository.saveAndFlush(
                    new EmailVerificationToken(user, tokenHash, now.plusHours(24))
            );
        } else {
            user.verifyEmail(now);
        }
        return true;
    }

    boolean registerParent(
            String email,
            String password,
            Optional<String> tokenHash,
            OffsetDateTime now
    ) {
        String passwordHash = passwordEncoder.encode(password);
        if (userRepository.findByEmail(email).isPresent()) {
            return false;
        }

        AppUser user = userRepository.save(AppUser.newParent(email, passwordHash));
        tokenHash.ifPresent(hash -> verificationTokenRepository.saveAndFlush(
                new EmailVerificationToken(user, hash, now.plusHours(24))
        ));
        return true;
    }

    Optional<String> issueVerificationToken(String email, String tokenHash, OffsetDateTime now) {
        Optional<AppUser> candidate = userRepository.findByEmailForUpdate(email)
                .filter(user -> !user.isEmailVerified());
        if (candidate.isEmpty()) {
            return Optional.empty();
        }

        AppUser user = candidate.get();
        if (withinCooldown(verificationTokenRepository.findLatestCreatedAtByUserId(user.getId()), now)
                || !rateLimiter.tryAcquire(
                        RateLimitRule.VERIFICATION_RESEND_ACCOUNT,
                        user.getId().toString()
                )) {
            return Optional.empty();
        }

        verificationTokenRepository.invalidateUnconsumedByUserId(user.getId(), now);
        verificationTokenRepository.saveAndFlush(
                new EmailVerificationToken(user, tokenHash, now.plusHours(24))
        );
        return Optional.of(user.getEmail());
    }

    Optional<String> issuePasswordResetToken(String email, String tokenHash, OffsetDateTime now) {
        Optional<AppUser> candidate = userRepository.findByEmailForUpdate(email)
                .filter(AppUser::isEmailVerified)
                .filter(AppUser::isEnabled);
        if (candidate.isEmpty()) {
            return Optional.empty();
        }

        AppUser user = candidate.get();
        if (withinCooldown(resetTokenRepository.findLatestCreatedAtByUserId(user.getId()), now)
                || !rateLimiter.tryAcquire(
                        RateLimitRule.PASSWORD_RECOVERY_ACCOUNT,
                        user.getId().toString()
                )) {
            return Optional.empty();
        }

        resetTokenRepository.invalidateUnconsumedByUserId(user.getId(), now);
        resetTokenRepository.saveAndFlush(new PasswordResetToken(user, tokenHash, now.plusMinutes(30)));
        return Optional.of(user.getEmail());
    }

    void verifyEmail(String tokenHash, OffsetDateTime now) {
        UUID userId = verificationTokenRepository.findUserIdByTokenHash(tokenHash)
                .orElseThrow(InvalidAuthTokenException::new);
        if (verificationTokenRepository.consumeIfValid(tokenHash, now) != 1) {
            throw new InvalidAuthTokenException();
        }
        userRepository.findById(userId)
                .orElseThrow(InvalidAuthTokenException::new)
                .verifyEmail(now);
    }

    UUID resetPassword(String tokenHash, String password, OffsetDateTime now) {
        UUID userId = resetTokenRepository.findUserIdByTokenHash(tokenHash)
                .orElseThrow(InvalidAuthTokenException::new);
        if (resetTokenRepository.consumeIfValid(tokenHash, now) != 1) {
            throw new InvalidAuthTokenException();
        }
        userRepository.findById(userId)
                .orElseThrow(InvalidAuthTokenException::new)
                .changePasswordHash(passwordEncoder.encode(password));
        return userId;
    }

    void deactivateAccount(UUID userId, OffsetDateTime now) {
        userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new IllegalStateException("Authenticated user " + userId + " not found"))
                .deactivate(now);
    }

    void changePassword(UUID userId, String currentPassword, String newPassword) {
        AppUser user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(InvalidCurrentPasswordException::new);
        if (!user.passwordMatches(currentPassword, passwordEncoder)) {
            throw new InvalidCurrentPasswordException();
        }
        if (user.passwordMatches(newPassword, passwordEncoder)) {
            throw new AuthValidationException(
                    "newPassword",
                    "New password must be different from the current password"
            );
        }
        user.changePasswordHash(passwordEncoder.encode(newPassword));
    }

    boolean issueEmailChange(
            UUID userId,
            String proposedEmail,
            String tokenHash,
            OffsetDateTime now
    ) {
        AppUser user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(InvalidAuthTokenException::new);
        if (user.getEmail().equals(proposedEmail)
                || userRepository.findByEmail(proposedEmail).isPresent()) {
            return false;
        }
        pendingEmailChangeRepository.invalidateExpiredByProposedEmail(proposedEmail, now);

        PendingEmailChange change = pendingEmailChangeRepository.findByUserId(userId)
                .orElseGet(() -> new PendingEmailChange(
                        user,
                        proposedEmail,
                        tokenHash,
                        now,
                        now.plusHours(24)
                ));
        if (change.getId() != null) {
            change.reissue(proposedEmail, tokenHash, now, now.plusHours(24));
        }
        pendingEmailChangeRepository.saveAndFlush(change);
        return true;
    }

    void invalidateEmailChange(String tokenHash, OffsetDateTime now) {
        pendingEmailChangeRepository.findByTokenHashForUpdate(tokenHash)
                .ifPresent(change -> change.invalidate(now));
    }

    Optional<ConfirmedEmailChange> confirmEmailChange(String tokenHash, OffsetDateTime now) {
        PendingEmailChange change = pendingEmailChangeRepository.findByTokenHashForUpdate(tokenHash)
                .orElseThrow(InvalidAuthTokenException::new);
        if (!change.consumeIfValid(now)) {
            return Optional.empty();
        }

        AppUser user = userRepository.findByIdForUpdate(change.getUser().getId())
                .orElseThrow(InvalidAuthTokenException::new);
        Optional<AppUser> conflict = userRepository.findByEmail(change.getProposedEmail())
                .filter(existing -> !existing.getId().equals(user.getId()));
        if (conflict.isPresent()) {
            return Optional.empty();
        }

        String oldEmail = user.getEmail();
        user.changeEmail(change.getProposedEmail(), now);
        userRepository.flush();
        return Optional.of(new ConfirmedEmailChange(user.getId(), oldEmail));
    }

    private boolean withinCooldown(Optional<OffsetDateTime> latest, OffsetDateTime now) {
        return latest.filter(createdAt -> createdAt.isAfter(now.minus(TOKEN_COOLDOWN))).isPresent();
    }

    record ConfirmedEmailChange(UUID userId, String oldEmail) {
    }
}
