package com.servisimibul.backend.auth.exception;

public class InvalidCurrentPasswordException extends RuntimeException {

    public InvalidCurrentPasswordException() {
        super("Current password is incorrect");
    }
}
