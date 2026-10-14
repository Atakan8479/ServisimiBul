package com.servisimibul.backend.geography.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record SchoolCreateRequest(
        @NotNull @Positive Long neighborhoodId,
        @NotBlank @Size(max = 255) String name,
        String address,
        @Size(max = 100) String sourceName,
        @Size(max = 100) String sourceCode,
        @NotNull Boolean active
) {
}
