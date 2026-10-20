package com.servisimibul.backend.identity;

import com.servisimibul.backend.auth.service.AuthInputValidator;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Component
@Profile("local")
@ConditionalOnProperty(name = "servisimibul.demo-parent-bootstrap.enabled", havingValue = "true")
@RequiredArgsConstructor
class DemoParentBootstrapRunner implements ApplicationRunner {

    private static final String PREFIX = "servisimibul.demo-parent-bootstrap.";

    private final Environment environment;
    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthInputValidator validator;
    private final JdbcTemplate jdbcTemplate;
    private final Clock clock;

    @Override
    @Transactional
    public void run(ApplicationArguments arguments) {
        requireDisposableDatabase();
        String email = validator.email(environment.getProperty(PREFIX + "email"));
        String password = validator.password(
                environment.getProperty(PREFIX + "password"),
                "parentPassword"
        );

        userRepository.findByEmail(email).ifPresentOrElse(existing -> {
            if (existing.getRole() != UserRole.PARENT || !existing.isEnabled()
                    || !existing.isEmailVerified() || !passwordEncoder.matches(password, existing.passwordHash())) {
                throw new IllegalStateException("Configured demo parent is not the expected active verified PARENT");
            }
        }, () -> {
            AppUser parent = AppUser.newParent(email, passwordEncoder.encode(password));
            parent.verifyEmail(OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC));
            userRepository.save(parent);
        });
        userRepository.flush();
    }

    private void requireDisposableDatabase() {
        if (!environment.getProperty(PREFIX + "disposable", Boolean.class, false)) {
            throw new IllegalStateException("Demo parent bootstrap requires an explicitly disposable database");
        }
        Integer markers = jdbcTemplate.queryForObject(
                "select count(*) from test_harness.database_instance",
                Integer.class
        );
        if (markers == null || markers != 1) {
            throw new IllegalStateException("Demo parent bootstrap requires exactly one disposable database marker");
        }
    }
}
