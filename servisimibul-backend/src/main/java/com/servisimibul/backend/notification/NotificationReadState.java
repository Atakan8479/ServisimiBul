package com.servisimibul.backend.notification;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Recipient-facing read filter; READ and UNREAD follow {@code readAt}. */
public enum NotificationReadState {
    ALL,
    UNREAD,
    READ;

    static NotificationReadState parse(String value) {
        for (NotificationReadState state : values()) {
            if (state.name().equals(value)) {
                return state;
            }
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid notification read state");
    }
}
