package com.servisimibul.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

class ClientIdentityResolverTests {

    private final ClientIdentityResolver resolver = new ClientIdentityResolver();

    @Test
    void usesOnlyTheNetworkPeerAndIgnoresSpoofableForwardingHeaders() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("203.0.113.10");
        request.addHeader("X-Forwarded-For", "198.51.100.7");
        request.addHeader("Forwarded", "for=198.51.100.8;proto=https");

        assertThat(resolver.resolve(request)).isEqualTo("203.0.113.10");
    }
}
