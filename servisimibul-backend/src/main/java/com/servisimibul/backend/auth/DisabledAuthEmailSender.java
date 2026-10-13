package com.servisimibul.backend.auth;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "servisimibul.email.enabled", havingValue = "false", matchIfMissing = true)
class DisabledAuthEmailSender implements AuthEmailSender {

    @Override
    public boolean isAvailable() {
        return false;
    }

    @Override
    public void sendVerification(String email, String rawToken) {
        throw new EmailUnavailableException();
    }

    @Override
    public void sendPasswordReset(String email, String rawToken) {
        throw new EmailUnavailableException();
    }
}
