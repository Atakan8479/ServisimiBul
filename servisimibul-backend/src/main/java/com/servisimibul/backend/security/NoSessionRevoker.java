package com.servisimibul.backend.security;

import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
class NoSessionRevoker implements SessionRevoker {

    @Override
    public void revokeAll(UUID userId) {
        // shortcut: B-04 owns session persistence; replace this no-op when Spring Session is added.
    }
}
