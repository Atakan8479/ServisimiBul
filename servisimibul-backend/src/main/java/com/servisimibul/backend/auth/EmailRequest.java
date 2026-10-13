package com.servisimibul.backend.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record EmailRequest(
        @NotBlank @Size(max = 254) String email
) {
}
