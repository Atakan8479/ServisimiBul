package com.servisimibul.backend.tariff.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class TariffDtos {

    private TariffDtos() {
    }

    public record TariffBand(
            BigDecimal minDistanceKm,
            BigDecimal maxDistanceKm,
            BigDecimal amountKurus
    ) {
    }

    public record TariffDocument(
            String provinceCode,
            String provinceName,
            String authority,
            String academicYear,
            String currency,
            LocalDate effectiveFrom,
            LocalDate effectiveTo,
            String sourceTitle,
            String officialSourceUrl,
            String version,
            List<TariffBand> bands
    ) {
        public TariffDocument {
            bands = bands == null ? null : List.copyOf(bands);
        }
    }

    public record TariffUpdateRequest(
            String expectedVersion,
            TariffDocument tariff
    ) {
    }
}
