package com.servisimibul.backend.auth.dto;

import jakarta.validation.constraints.NotNull;

public record ChangePasswordRequest(
        @NotNull String currentPassword,
        @NotNull String newPassword
) {
}
