package com.servisimibul.backend.identity;

import com.servisimibul.backend.auth.config.ParentEmailVerificationProperties;
import com.servisimibul.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
@RequiredArgsConstructor
class DatabaseUserDetailsService implements UserDetailsService {

    private final AppUserRepository userRepository;
    private final ParentEmailVerificationProperties parentEmailVerification;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        AppUser user = userRepository.findByEmail(email.strip().toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new UsernameNotFoundException("Invalid credentials"));

        boolean emailVerificationSatisfied = user.getRole() == UserRole.PARENT
                ? !parentEmailVerification.required() || user.isEmailVerified()
                : user.isEmailVerified();
        return new AuthenticatedUser(
                user.getId(),
                user.getEmail(),
                user.passwordHash(),
                user.getRole(),
                user.isEnabled() && emailVerificationSatisfied,
                user.isEmailVerified()
        );
    }
}
