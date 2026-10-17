package com.servisimibul.backend.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

@Component
public class ClientIdentityResolver {

    public String resolve(HttpServletRequest request) {
        String peerAddress = request.getRemoteAddr();
        return peerAddress == null || peerAddress.isBlank() ? "unknown" : peerAddress;
    }
}
