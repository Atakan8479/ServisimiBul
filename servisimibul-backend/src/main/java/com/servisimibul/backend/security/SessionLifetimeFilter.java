package com.servisimibul.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Clock;

@RequiredArgsConstructor
public class SessionLifetimeFilter extends OncePerRequestFilter {

    public static final String REMEMBER_UNTIL_ATTRIBUTE = "servisimibul.rememberUntil";

    private final Clock clock;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        HttpSession session = request.getSession(false);
        if (session != null && session.getAttribute(REMEMBER_UNTIL_ATTRIBUTE) instanceof Long rememberUntil) {
            long remainingMillis = rememberUntil - clock.millis();
            if (remainingMillis <= 0) {
                session.invalidate();
                SecurityContextHolder.clearContext();
            } else {
                int remainingSeconds = Math.toIntExact((remainingMillis + 999) / 1_000);
                session.setMaxInactiveInterval(remainingSeconds);
                request.setAttribute(REMEMBER_UNTIL_ATTRIBUTE, rememberUntil);
            }
        }
        filterChain.doFilter(request, response);
    }
}
