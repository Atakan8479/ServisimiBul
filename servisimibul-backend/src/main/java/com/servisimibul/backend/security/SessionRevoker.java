package com.servisimibul.backend.security;

import java.util.UUID;

public interface SessionRevoker {

    void revokeAll(UUID userId);

    default void revokeAll(String principalName) {
        throw new UnsupportedOperationException("Principal-name revocation is unavailable");
    }
}
