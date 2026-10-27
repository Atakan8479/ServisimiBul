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
            BigDecimal amountKurus,
            BigDecimal annualAmountKurus
    ) {
        public TariffBand(
                BigDecimal minDistanceKm,
                BigDecimal maxDistanceKm,
                BigDecimal amountKurus
        ) {
            this(minDistanceKm, maxDistanceKm, amountKurus, null);
        }
    }

    public record AdditionalKilometerRule(
            BigDecimal startsAfterDistanceKm,
            BigDecimal monthlyAmountPerKilometerKurus
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
            AdditionalKilometerRule additionalKilometerRule,
            List<String> notes,
            List<TariffBand> bands
    ) {
        public TariffDocument {
            notes = notes == null ? null : List.copyOf(notes);
            bands = bands == null ? null : List.copyOf(bands);
        }

        public TariffDocument(
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
            this(
                    provinceCode,
                    provinceName,
                    authority,
                    academicYear,
                    currency,
                    effectiveFrom,
                    effectiveTo,
                    sourceTitle,
                    officialSourceUrl,
                    version,
                    null,
                    null,
                    bands
            );
        }
    }

    public record TariffUpdateRequest(
            String expectedVersion,
            TariffDocument tariff
    ) {
    }
}
