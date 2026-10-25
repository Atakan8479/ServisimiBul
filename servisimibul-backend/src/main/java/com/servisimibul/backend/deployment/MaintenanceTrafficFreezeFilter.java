package com.servisimibul.backend.deployment;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Deployment-scoped HTTP quarantine, not a database-wide writer lock.
 * Turn on only alongside disabling background schedulers and stopping all other writers.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public final class MaintenanceTrafficFreezeFilter extends OncePerRequestFilter {

    private final boolean frozen;

    public MaintenanceTrafficFreezeFilter(
            @Value("${app.maintenance.traffic-frozen:false}") boolean frozen) {
        this.frozen = frozen;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String context = request.getContextPath() == null ? "" : request.getContextPath();
        boolean liveness = "GET".equals(request.getMethod())
                && (context + "/livez").equals(request.getRequestURI());
        if (!frozen || liveness) {
            chain.doFilter(request, response);
            return;
        }
        response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
        response.setHeader("Cache-Control", "no-store");
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"SERVICE_MAINTENANCE\"}");
    }
}
