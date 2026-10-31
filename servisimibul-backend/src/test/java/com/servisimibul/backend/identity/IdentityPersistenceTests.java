package com.servisimibul.backend.identity;

import com.servisimibul.backend.security.TokenHasher;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.time.OffsetDateTime;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
class IdentityPersistenceTests {

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private OperatorProfileRepository profileRepository;

    @Autowired
    private EmailVerificationTokenRepository emailTokenRepository;

    @Autowired
    private PasswordResetTokenRepository resetTokenRepository;

    @Autowired
    private OperatorApplicationReviewRepository reviewRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private TokenHasher tokenHasher;

    @Test
    void newOperatorHasApprovedIdentityDefaultsWithoutPublicAdminFactory() {
        String passwordHash = passwordEncoder.encode("correct horse battery staple");
        AppUser user = userRepository.saveAndFlush(
                AppUser.newOperator("  Operator@Example.COM ", passwordHash)
        );
        OperatorProfile profile = profileRepository.saveAndFlush(
                new OperatorProfile(user, "Example Transport", "+905551112233")
        );

        assertThat(user.getEmail()).isEqualTo("operator@example.com");
        assertThat(user.getRole()).isEqualTo(UserRole.OPERATOR);
        assertThat(user.isEnabled()).isTrue();
        assertThat(user.isEmailVerified()).isFalse();
        assertThat(passwordEncoder.matches("correct horse battery staple", passwordHash)).isTrue();
        assertThat(profile.getApprovalStatus()).isEqualTo(OperatorApprovalStatus.DRAFT);
        assertThat(profile.isActive()).isTrue();
        assertThat(profile.isPubliclyVisible()).isTrue();
        assertThat(profileRepository.findByUserId(user.getId())).contains(profile);
        assertThat(Arrays.stream(AppUser.class.getMethods()).map(Method::getName))
                .doesNotContain("newAdmin", "getPasswordHash");
        assertThat(OperatorApprovalStatus.values()).containsExactly(
                OperatorApprovalStatus.DRAFT,
                OperatorApprovalStatus.PENDING,
                OperatorApprovalStatus.CHANGES_REQUESTED,
                OperatorApprovalStatus.APPROVED
        );
    }

    @Test
    void verificationAndResetTokensCanOnlyBeConsumedOnce() {
        AppUser user = userRepository.saveAndFlush(
                AppUser.newOperator("tokens@example.com", passwordEncoder.encode("a secure password"))
        );
        OffsetDateTime now = OffsetDateTime.now();
        String verificationHash = tokenHasher.hash("verification-token");
        String resetHash = tokenHasher.hash("reset-token");

        emailTokenRepository.saveAndFlush(
                new EmailVerificationToken(user, verificationHash, now.plusHours(24))
        );
        resetTokenRepository.saveAndFlush(
                new PasswordResetToken(user, resetHash, now.plusMinutes(30))
        );

        assertThat(verificationHash).hasSize(64).doesNotContain("verification-token");
        assertThat(resetHash).hasSize(64).doesNotContain("reset-token");
        OffsetDateTime consumedAt = now.plusSeconds(1);
        assertThat(emailTokenRepository.consumeIfValid(verificationHash, consumedAt)).isOne();
        assertThat(emailTokenRepository.consumeIfValid(verificationHash, consumedAt.plusSeconds(1))).isZero();
        assertThat(resetTokenRepository.consumeIfValid(resetHash, consumedAt)).isOne();
        assertThat(resetTokenRepository.consumeIfValid(resetHash, consumedAt.plusSeconds(1))).isZero();
    }

    @Test
    void expiredTokenCannotBeConsumed() {
        AppUser user = userRepository.saveAndFlush(
                AppUser.newOperator("expired@example.com", passwordEncoder.encode("a secure password"))
        );
        OffsetDateTime now = OffsetDateTime.now();
        String tokenHash = tokenHasher.hash("expired-token");
        emailTokenRepository.saveAndFlush(
                new EmailVerificationToken(user, tokenHash, now.plusSeconds(10))
        );

        assertThat(emailTokenRepository.consumeIfValid(tokenHash, now.plusSeconds(11))).isZero();
    }

    @Test
    void correctionReviewRequiresReason() {
        AppUser operator = userRepository.saveAndFlush(
                AppUser.newOperator("reviewed@example.com", passwordEncoder.encode("a secure password"))
        );
        AppUser admin = userRepository.saveAndFlush(
                AppUser.newAdmin("admin@example.com", passwordEncoder.encode("another secure password"))
        );
        OperatorProfile profile = profileRepository.saveAndFlush(
                new OperatorProfile(operator, "Reviewed Transport", "+905551112244")
        );

        assertThatThrownBy(() -> reviewRepository.saveAndFlush(
                new OperatorApplicationReview(
                        profile,
                        admin,
                        ReviewDecision.CHANGES_REQUESTED,
                        " "
                )
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void blankSuspensionReasonIsRejectedByTheSchema() {
        AppUser operator = userRepository.saveAndFlush(
                AppUser.newOperator("suspension-reviewed@example.com", passwordEncoder.encode("a secure password"))
        );
        AppUser admin = userRepository.saveAndFlush(
                AppUser.newAdmin("suspension-admin@example.com", passwordEncoder.encode("another secure password"))
        );
        OperatorProfile profile = profileRepository.saveAndFlush(
                new OperatorProfile(operator, "Reviewed Transport", "+905551112244")
        );

        assertThatThrownBy(() -> reviewRepository.saveAndFlush(
                new OperatorApplicationReview(
                        profile,
                        admin,
                        ReviewDecision.SUSPENDED,
                        " "
                )
        )).isInstanceOf(DataIntegrityViolationException.class);
    }
}
