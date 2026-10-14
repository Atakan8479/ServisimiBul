package com.servisimibul.backend.identity;

import com.servisimibul.backend.auth.service.AuthInputValidator;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Component
@ConditionalOnProperty(name = "servisimibul.admin-bootstrap.enabled", havingValue = "true")
@RequiredArgsConstructor
class AdminBootstrapRunner implements ApplicationRunner {

    private static final String PREFIX = "servisimibul.admin-bootstrap.";

    private final Environment environment;
    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthInputValidator validator;
    private final Clock clock;

    @Override
    @Transactional
    public void run(ApplicationArguments arguments) {
        List<AdminCredential> admins = List.of(
                credential("first"),
                credential("second")
        );
        if (admins.getFirst().email().equals(admins.getLast().email())) {
            throw new IllegalStateException("Admin bootstrap requires two distinct email addresses");
        }

        admins.forEach(this::createOrVerifyAdmin);
        userRepository.flush();
        if (userRepository.countByRole(UserRole.ADMIN) != 2) {
            throw new IllegalStateException("Admin bootstrap requires exactly two ADMIN accounts");
        }
    }

    private AdminCredential credential(String position) {
        String email = validator.email(environment.getProperty(PREFIX + position + "-email"));
        String password = validator.password(
                environment.getProperty(PREFIX + position + "-password"),
                position + "Password"
        );
        return new AdminCredential(email, password);
    }

    private void createOrVerifyAdmin(AdminCredential credential) {
        userRepository.findByEmail(credential.email()).ifPresentOrElse(existing -> {
            if (existing.getRole() != UserRole.ADMIN || !existing.isEnabled() || !existing.isEmailVerified()) {
                throw new IllegalStateException("Configured admin identity is not an active verified ADMIN");
            }
        }, () -> {
            AppUser admin = AppUser.newAdmin(
                    credential.email(),
                    passwordEncoder.encode(credential.password())
            );
            admin.verifyEmail(OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC));
            userRepository.save(admin);
        });
    }

    private record AdminCredential(String email, String password) {
    }
}
