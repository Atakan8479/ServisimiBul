package com.servisimibul.backend.security;

import com.servisimibul.backend.identity.UserRole;
import org.springframework.security.core.CredentialsContainer;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public final class AuthenticatedUser implements UserDetails, CredentialsContainer {

    private final UUID id;
    private final String email;
    private final UserRole role;
    private final boolean enabled;
    private String passwordHash;

    public AuthenticatedUser(
            UUID id,
            String email,
            String passwordHash,
            UserRole role,
            boolean enabled
    ) {
        this.id = id;
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
        this.enabled = enabled;
    }

    public UUID id() {
        return id;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }

    @Override
    public void eraseCredentials() {
        passwordHash = null;
    }

    @Override
    public String toString() {
        return "AuthenticatedUser[id=" + id + ", role=" + role + "]";
    }
}
