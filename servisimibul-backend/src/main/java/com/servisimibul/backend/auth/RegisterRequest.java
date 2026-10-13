package com.servisimibul.backend.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Size(max = 254) String email,
        @NotNull String password,
        @NotBlank @Size(max = 120) String businessName,
        @NotBlank String contactPhone
) {
}
