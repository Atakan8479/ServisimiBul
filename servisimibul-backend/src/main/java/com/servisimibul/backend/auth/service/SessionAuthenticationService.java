package com.servisimibul.backend.auth.service;

import com.servisimibul.backend.auth.dto.CurrentUserResponse;
import com.servisimibul.backend.auth.dto.LoginRequest;
import com.servisimibul.backend.auth.exception.InvalidCredentialsException;
import com.servisimibul.backend.security.AuthenticatedUser;
import com.servisimibul.backend.security.SessionLifetimeFilter;
import com.servisimibul.backend.ratelimit.InMemoryRateLimiter;
import com.servisimibul.backend.ratelimit.RateLimitRule;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.util.Comparator;
import java.util.Locale;

@Service
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@RequiredArgsConstructor
public class SessionAuthenticationService {

    private static final Duration NORMAL_SESSION = Duration.ofMinutes(30);
    private static final Duration REMEMBERED_SESSION = Duration.ofDays(90);
    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository securityContextRepository;
    private final FindByIndexNameSessionRepository<?> sessionRepository;
    private final InMemoryRateLimiter rateLimiter;
    private final Clock clock;
    private final CurrentUserResponseFactory currentUserResponseFactory;

    public CurrentUserResponse login(
            LoginRequest request,
            String remoteAddress,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse
    ) {
        String email = request.email().strip().toLowerCase(Locale.ROOT);
        // Apply the peer limit first so account-key churn cannot fill exact storage.
        rateLimiter.requireAllowance(RateLimitRule.LOGIN_IP, remoteAddress);
        rateLimiter.requireAllowance(RateLimitRule.LOGIN_ACCOUNT, email);

        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(email, request.password())
            );
        } catch (AuthenticationException rejected) {
            throw new InvalidCredentialsException();
        }

        AuthenticatedUser user = (AuthenticatedUser) authentication.getPrincipal();
        HttpSession existingSession = httpRequest.getSession(false);
        removeOldestExcessSessions(user.getUsername(), existingSession == null ? null : existingSession.getId());

        HttpSession session = existingSession == null
                ? httpRequest.getSession()
                : rotateSession(httpRequest);
        configureLifetime(session, request.rememberMe(), httpRequest);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, httpRequest, httpResponse);

        return currentUserResponseFactory.create(user);
    }

    private HttpSession rotateSession(HttpServletRequest request) {
        request.changeSessionId();
        return request.getSession(false);
    }

    private void configureLifetime(HttpSession session, boolean rememberMe, HttpServletRequest request) {
        if (!rememberMe) {
            session.removeAttribute(SessionLifetimeFilter.REMEMBER_UNTIL_ATTRIBUTE);
            session.setMaxInactiveInterval(Math.toIntExact(NORMAL_SESSION.toSeconds()));
            return;
        }

        long rememberUntil = clock.instant().plus(REMEMBERED_SESSION).toEpochMilli();
        session.setAttribute(SessionLifetimeFilter.REMEMBER_UNTIL_ATTRIBUTE, rememberUntil);
        session.setMaxInactiveInterval(Math.toIntExact(REMEMBERED_SESSION.toSeconds()));
        request.setAttribute(SessionLifetimeFilter.REMEMBER_UNTIL_ATTRIBUTE, rememberUntil);
    }

    private void removeOldestExcessSessions(String email, String currentSessionId) {
        // shortcut: eviction is per app instance; add shared locking before running multiple backend instances.
        var otherSessions = sessionRepository.findByPrincipalName(email).values().stream()
                .filter(session -> !session.getId().equals(currentSessionId))
                .sorted(Comparator.comparing(session -> session.getCreationTime()))
                .toList();

        int sessionsToRemove = Math.max(0, otherSessions.size() - 1);
        for (int index = 0; index < sessionsToRemove; index++) {
            sessionRepository.deleteById(otherSessions.get(index).getId());
        }
    }
}
