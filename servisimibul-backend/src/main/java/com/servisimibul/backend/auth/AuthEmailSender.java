package com.servisimibul.backend.auth;

interface AuthEmailSender {

    boolean isAvailable();

    void sendVerification(String email, String rawToken);

    void sendPasswordReset(String email, String rawToken);
}
