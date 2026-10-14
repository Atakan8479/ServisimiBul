package com.servisimibul.backend.security;

import org.springframework.boot.autoconfigure.condition.ConditionalOnNotWebApplication;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@ConditionalOnNotWebApplication
class NoSessionRevoker implements SessionRevoker {

    @Override
    public void revokeAll(UUID userId) {
        // The one-shot non-web admin command cannot have browser sessions.
    }
}
