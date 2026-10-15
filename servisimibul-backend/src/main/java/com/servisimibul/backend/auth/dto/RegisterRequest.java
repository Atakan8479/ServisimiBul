package com.servisimibul.backend.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Size(max = 254) String email,
        @NotNull String password,
        @Size(max = 120) String businessName,
        @NotBlank String contactPhone
) {
}
