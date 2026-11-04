package com.servisimibul.backend.auth.exception;

public final class AccountDeactivationUnavailableException extends RuntimeException {

    public AccountDeactivationUnavailableException() {
        super("Account deactivation is not available");
    }
}
