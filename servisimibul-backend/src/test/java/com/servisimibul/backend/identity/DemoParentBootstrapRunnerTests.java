package com.servisimibul.backend.identity;

import com.servisimibul.backend.auth.service.AuthInputValidator;
import org.junit.jupiter.api.Test;
import org.springframework.boot.ApplicationArguments;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DemoParentBootstrapRunnerTests {

    private static final String EMAIL = "parent@example.test";
    private static final String PASSWORD = "unique parent password";

    private final AppUserRepository userRepository = mock(AppUserRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final MockEnvironment environment = new MockEnvironment()
            .withProperty("servisimibul.demo-parent-bootstrap.email", EMAIL)
            .withProperty("servisimibul.demo-parent-bootstrap.password", PASSWORD);
    private final DemoParentBootstrapRunner runner = new DemoParentBootstrapRunner(
            environment,
            userRepository,
            passwordEncoder,
            new AuthInputValidator(),
            jdbcTemplate,
            Clock.fixed(Instant.parse("2026-10-20T00:00:00Z"), ZoneOffset.UTC)
    );

    @Test
    void refusesAnyDatabaseNotExplicitlyMarkedDisposable() {
        assertThat(DemoParentBootstrapRunner.class.getAnnotation(Profile.class).value())
                .containsExactly("local");
        assertThatThrownBy(() -> runner.run(mock(ApplicationArguments.class)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("explicitly disposable");

        verify(userRepository, never()).save(any());
    }

    @Test
    void createsAHashedVerifiedParentInAMarkedDisposableDatabase() {
        environment.withProperty("servisimibul.demo-parent-bootstrap.disposable", "true");
        when(jdbcTemplate.queryForObject(
                "select count(*) from test_harness.database_instance",
                Integer.class
        )).thenReturn(1);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());
        when(passwordEncoder.encode(PASSWORD)).thenReturn("encoded-password");

        runner.run(mock(ApplicationArguments.class));

        var parent = org.mockito.ArgumentCaptor.forClass(AppUser.class);
        verify(userRepository).save(parent.capture());
        assertThat(parent.getValue().getEmail()).isEqualTo(EMAIL);
        assertThat(parent.getValue().getRole()).isEqualTo(UserRole.PARENT);
        assertThat(parent.getValue().passwordHash()).isEqualTo("encoded-password");
        assertThat(parent.getValue().isEmailVerified()).isTrue();
        verify(userRepository).flush();
    }

    @Test
    void acceptsAnExistingMatchingParentWithoutChangingCredentials() {
        environment.withProperty("servisimibul.demo-parent-bootstrap.disposable", "true");
        AppUser parent = AppUser.newParent(EMAIL, "existing-hash");
        parent.verifyEmail(OffsetDateTime.now());
        when(jdbcTemplate.queryForObject(
                "select count(*) from test_harness.database_instance",
                Integer.class
        )).thenReturn(1);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(parent));
        when(passwordEncoder.matches(PASSWORD, "existing-hash")).thenReturn(true);

        runner.run(mock(ApplicationArguments.class));

        verify(userRepository, never()).save(any());
        verify(userRepository).flush();
    }
}
