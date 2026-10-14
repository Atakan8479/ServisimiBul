package com.servisimibul.backend.identity;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "servisimibul.admin-bootstrap.enabled=true",
                "servisimibul.admin-bootstrap.first-email=bootstrap-one@example.com",
                "servisimibul.admin-bootstrap.first-password=first bootstrap password",
                "servisimibul.admin-bootstrap.second-email=bootstrap-two@example.com",
                "servisimibul.admin-bootstrap.second-password=second bootstrap password"
        }
)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AdminBootstrapTests {

    @Autowired
    private AdminBootstrapRunner runner;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void createsExactlyTwoVerifiedAdminsAndDoesNotReplacePasswordsOnRerun() throws Exception {
        AppUser first = userRepository.findByEmail("bootstrap-one@example.com").orElseThrow();
        AppUser second = userRepository.findByEmail("bootstrap-two@example.com").orElseThrow();
        String firstHash = first.passwordHash();
        String secondHash = second.passwordHash();

        assertThat(userRepository.countByRole(UserRole.ADMIN)).isEqualTo(2);
        assertThat(first.isEmailVerified()).isTrue();
        assertThat(second.isEmailVerified()).isTrue();
        assertThat(passwordEncoder.matches("first bootstrap password", firstHash)).isTrue();
        assertThat(passwordEncoder.matches("second bootstrap password", secondHash)).isTrue();

        runner.run(new DefaultApplicationArguments());

        assertThat(userRepository.findByEmail(first.getEmail()).orElseThrow().passwordHash()).isEqualTo(firstHash);
        assertThat(userRepository.findByEmail(second.getEmail()).orElseThrow().passwordHash()).isEqualTo(secondHash);
    }

    @AfterAll
    void removeBootstrapAdmins() {
        userRepository.findByEmail("bootstrap-one@example.com").ifPresent(userRepository::delete);
        userRepository.findByEmail("bootstrap-two@example.com").ifPresent(userRepository::delete);
        userRepository.flush();
    }
}
