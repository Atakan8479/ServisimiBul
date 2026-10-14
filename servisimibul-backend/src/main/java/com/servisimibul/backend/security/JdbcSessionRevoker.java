package com.servisimibul.backend.security;

import com.servisimibul.backend.identity.AppUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@RequiredArgsConstructor
class JdbcSessionRevoker implements SessionRevoker {

    private final AppUserRepository userRepository;
    private final FindByIndexNameSessionRepository<? extends Session> sessionRepository;

    @Override
    public void revokeAll(UUID userId) {
        userRepository.findById(userId).ifPresent(user ->
                sessionRepository.findByPrincipalName(user.getEmail()).values()
                        .forEach(session -> sessionRepository.deleteById(session.getId()))
        );
    }
}
