package com.servisimibul.backend.security;

import java.util.UUID;

public interface SessionRevoker {

    void revokeAll(UUID userId);
}
