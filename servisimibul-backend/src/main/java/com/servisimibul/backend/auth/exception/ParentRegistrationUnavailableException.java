package com.servisimibul.backend.auth.exception;

public final class ParentRegistrationUnavailableException extends RuntimeException {

    public ParentRegistrationUnavailableException() {
        super("Parent registration is not available");
    }
}
