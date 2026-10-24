package com.servisimibul.backend.security;

import com.servisimibul.backend.auth.config.ParentEmailVerificationProperties;
import com.servisimibul.backend.identity.UserRole;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@RequiredArgsConstructor
public class ParentVerificationSessionFilter extends OncePerRequestFilter {

    private final ParentEmailVerificationProperties properties;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (properties.required()
                && authentication != null
                && authentication.getPrincipal() instanceof AuthenticatedUser user
                && user.role() == UserRole.PARENT
                && !user.emailVerified()) {
            HttpSession session = request.getSession(false);
            if (session != null) {
                session.invalidate();
            }
            SecurityContextHolder.clearContext();
        }
        filterChain.doFilter(request, response);
    }
}
