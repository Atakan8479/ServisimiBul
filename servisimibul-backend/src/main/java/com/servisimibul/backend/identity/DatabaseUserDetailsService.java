package com.servisimibul.backend.identity;

import com.servisimibul.backend.security.AuthenticatedUser;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
class DatabaseUserDetailsService implements UserDetailsService {

    private final AppUserRepository userRepository;

    DatabaseUserDetailsService(AppUserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        AppUser user = userRepository.findByEmail(email.strip().toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new UsernameNotFoundException("Invalid credentials"));

        return new AuthenticatedUser(
                user.getId(),
                user.getEmail(),
                user.passwordHash(),
                user.getRole(),
                user.isEnabled() && user.isEmailVerified()
        );
    }
}
