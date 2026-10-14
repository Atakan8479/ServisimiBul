package com.servisimibul.backend.auth.service;

import com.servisimibul.backend.auth.exception.InvalidAuthTokenException;
import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import com.servisimibul.backend.identity.EmailVerificationToken;
import com.servisimibul.backend.identity.EmailVerificationTokenRepository;
import com.servisimibul.backend.identity.OperatorProfile;
import com.servisimibul.backend.identity.OperatorProfileRepository;
import com.servisimibul.backend.identity.PasswordResetToken;
import com.servisimibul.backend.identity.PasswordResetTokenRepository;
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
    private static final Duration ACCOUNT_LIMIT_WINDOW = Duration.ofHours(1);
    private static final int ACCOUNT_LIMIT = 5;

    private final AppUserRepository userRepository;
    private final OperatorProfileRepository profileRepository;
    private final EmailVerificationTokenRepository verificationTokenRepository;
    private final PasswordResetTokenRepository resetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthRateLimiter rateLimiter;

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
        verificationTokenRepository.saveAndFlush(
                new EmailVerificationToken(user, tokenHash, now.plusHours(24))
        );
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
                        "verification-account:" + user.getId(),
                        ACCOUNT_LIMIT,
                        ACCOUNT_LIMIT_WINDOW,
                        now.toInstant()
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
                        "reset-account:" + user.getId(),
                        ACCOUNT_LIMIT,
                        ACCOUNT_LIMIT_WINDOW,
                        now.toInstant()
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

    private boolean withinCooldown(Optional<OffsetDateTime> latest, OffsetDateTime now) {
        return latest.filter(createdAt -> createdAt.isAfter(now.minus(TOKEN_COOLDOWN))).isPresent();
    }
}
