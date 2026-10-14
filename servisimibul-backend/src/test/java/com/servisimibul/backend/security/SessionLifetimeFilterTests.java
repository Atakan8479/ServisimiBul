package com.servisimibul.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class SessionLifetimeFilterTests {

    private static final Instant NOW = Instant.parse("2026-10-14T12:00:00Z");

    @Test
    void rememberedSessionKeepsItsAbsoluteDeadline() throws Exception {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(SessionLifetimeFilter.REMEMBER_UNTIL_ATTRIBUTE, NOW.plusSeconds(60).toEpochMilli());
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setSession(session);

        filter().doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        assertThat(session.getMaxInactiveInterval()).isEqualTo(60);
        assertThat(request.getAttribute(SessionLifetimeFilter.REMEMBER_UNTIL_ATTRIBUTE))
                .isEqualTo(NOW.plusSeconds(60).toEpochMilli());
    }

    @Test
    void rememberedSessionIsInvalidatedAtItsDeadline() throws Exception {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(SessionLifetimeFilter.REMEMBER_UNTIL_ATTRIBUTE, NOW.minusMillis(1).toEpochMilli());
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setSession(session);

        filter().doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        assertThat(session.isInvalid()).isTrue();
    }

    private SessionLifetimeFilter filter() {
        return new SessionLifetimeFilter(Clock.fixed(NOW, ZoneOffset.UTC));
    }
}
