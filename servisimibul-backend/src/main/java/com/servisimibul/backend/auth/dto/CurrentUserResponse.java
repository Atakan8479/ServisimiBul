package com.servisimibul.backend.auth.dto;

import com.servisimibul.backend.identity.UserRole;

import java.util.UUID;

public record CurrentUserResponse(UUID id, String email, UserRole role) {
}
