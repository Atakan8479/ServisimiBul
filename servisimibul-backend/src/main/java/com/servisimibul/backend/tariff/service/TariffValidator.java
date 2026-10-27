package com.servisimibul.backend.tariff.service;

import com.servisimibul.backend.tariff.dto.TariffDtos.AdditionalKilometerRule;
import com.servisimibul.backend.tariff.dto.TariffDtos.TariffBand;
import com.servisimibul.backend.tariff.dto.TariffDtos.TariffDocument;
import com.servisimibul.backend.tariff.exception.TariffApiException;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

@Component
public class TariffValidator {

    private static final Pattern PROVINCE_CODE = Pattern.compile("\\d{2}");
    private static final Pattern VERSION = Pattern.compile("[A-Za-z0-9](?:[A-Za-z0-9._-]{0,62}[A-Za-z0-9])?");
    private static final int MAX_BANDS = 100;
    private static final int MAX_NOTES = 50;

    public String normalizeProvinceCode(String provinceCode, String field) {
        String normalized = trim(provinceCode);
        if (normalized == null || !PROVINCE_CODE.matcher(normalized).matches()) {
            throw TariffApiException.validation(Map.of(field, "must be a two-digit province code"));
        }
        int numericCode = Integer.parseInt(normalized);
        if (numericCode < 1 || numericCode > 81) {
            throw TariffApiException.validation(Map.of(field, "must identify a Turkish province from 01 to 81"));
        }
        return normalized;
    }

    public TariffDocument validateAndNormalize(TariffDocument document) {
        Map<String, String> errors = new LinkedHashMap<>();
        if (document == null) {
            throw TariffApiException.validation(Map.of("tariff", "is required"));
        }

        String provinceCode = validateProvinceCode(document.provinceCode(), errors);
        String provinceName = required(document.provinceName(), "tariff.provinceName", 120, errors);
        String authority = required(document.authority(), "tariff.authority", 200, errors);
        String academicYear = required(document.academicYear(), "tariff.academicYear", 50, errors);
        String currency = required(document.currency(), "tariff.currency", 3, errors);
        if (currency != null) {
            currency = currency.toUpperCase(Locale.ROOT);
            if (!"TRY".equals(currency)) {
                errors.putIfAbsent("tariff.currency", "must be TRY for the UKOME tariff");
            }
        }
        String sourceTitle = required(document.sourceTitle(), "tariff.sourceTitle", 300, errors);
        String officialSourceUrl = validateOfficialUrl(document.officialSourceUrl(), errors);
        String version = validateVersion(document.version(), errors);

        if (document.effectiveFrom() == null) {
            errors.put("tariff.effectiveFrom", "is required");
        }
        if (document.effectiveFrom() != null
                && document.effectiveTo() != null
                && document.effectiveTo().isBefore(document.effectiveFrom())) {
            errors.put("tariff.effectiveTo", "must be on or after effectiveFrom");
        }

        boolean hasAdditionalKilometerRule = document.additionalKilometerRule() != null;
        List<TariffBand> bands = validateBands(
                document.bands(),
                hasAdditionalKilometerRule,
                errors
        );
        AdditionalKilometerRule additionalKilometerRule = validateAdditionalKilometerRule(
                document.additionalKilometerRule(),
                bands,
                errors
        );
        List<String> notes = validateNotes(document.notes(), errors);
        if (!errors.isEmpty()) {
            throw TariffApiException.validation(errors);
        }

        return new TariffDocument(
                provinceCode,
                provinceName,
                authority,
                academicYear,
                currency,
                document.effectiveFrom(),
                document.effectiveTo(),
                sourceTitle,
                officialSourceUrl,
                version,
                additionalKilometerRule,
                notes,
                bands
        );
    }

    private String validateProvinceCode(String value, Map<String, String> errors) {
        String normalized = trim(value);
        if (normalized == null || !PROVINCE_CODE.matcher(normalized).matches()) {
            errors.put("tariff.provinceCode", "must be a two-digit province code");
            return normalized;
        }
        int numericCode = Integer.parseInt(normalized);
        if (numericCode < 1 || numericCode > 81) {
            errors.put("tariff.provinceCode", "must identify a Turkish province from 01 to 81");
        }
        return normalized;
    }

    private String validateVersion(String value, Map<String, String> errors) {
        String normalized = trim(value);
        if (normalized == null || !VERSION.matcher(normalized).matches()) {
            errors.put(
                    "tariff.version",
                    "must be 1-64 letters, digits, dots, underscores, or hyphens and start/end with a letter or digit"
            );
        }
        return normalized;
    }

    private String validateOfficialUrl(String value, Map<String, String> errors) {
        String normalized = required(value, "tariff.officialSourceUrl", 2_000, errors);
        if (normalized == null) {
            return null;
        }
        try {
            URI uri = new URI(normalized);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) {
                errors.put("tariff.officialSourceUrl", "must be an absolute HTTPS URL");
            }
        } catch (URISyntaxException exception) {
            errors.put("tariff.officialSourceUrl", "must be an absolute HTTPS URL");
        }
        return normalized;
    }

    private List<TariffBand> validateBands(
            List<TariffBand> input,
            boolean hasAdditionalKilometerRule,
            Map<String, String> errors
    ) {
        if (input == null || input.isEmpty()) {
            errors.put("tariff.bands", "must contain at least one distance band");
            return List.of();
        }
        if (input.size() > MAX_BANDS) {
            errors.put("tariff.bands", "must contain at most " + MAX_BANDS + " distance bands");
            return List.of();
        }

        List<TariffBand> normalized = new ArrayList<>(input.size());
        boolean hasAnnualAmounts = input.stream()
                .filter(java.util.Objects::nonNull)
                .anyMatch(band -> band.annualAmountKurus() != null);
        boolean requireAnnualAmounts = hasAnnualAmounts || hasAdditionalKilometerRule;
        BigDecimal expectedMinimum = BigDecimal.ZERO;
        for (int index = 0; index < input.size(); index++) {
            TariffBand band = input.get(index);
            String prefix = "tariff.bands[" + index + "]";
            if (band == null) {
                errors.put(prefix, "is required");
                continue;
            }

            BigDecimal minimum = normalizeNumber(band.minDistanceKm());
            BigDecimal maximum = normalizeNumber(band.maxDistanceKm());
            BigDecimal amount = validateKurus(
                    band.amountKurus(),
                    prefix + ".amountKurus",
                    true,
                    errors
            );
            BigDecimal annualAmount = validateKurus(
                    band.annualAmountKurus(),
                    prefix + ".annualAmountKurus",
                    requireAnnualAmounts,
                    errors
            );

            if (minimum == null) {
                errors.put(prefix + ".minDistanceKm", "is required");
            } else {
                if (minimum.signum() < 0) {
                    errors.put(prefix + ".minDistanceKm", "must be nonnegative");
                }
                if (minimum.compareTo(expectedMinimum) != 0) {
                    errors.put(prefix + ".minDistanceKm", "must equal the previous band's maximum");
                }
            }

            boolean finalBand = index == input.size() - 1;
            if (finalBand && hasAdditionalKilometerRule && maximum == null) {
                errors.put(
                        prefix + ".maxDistanceKm",
                        "is required when an additional-kilometer rule follows the fixed bands"
                );
            } else if (finalBand && !hasAdditionalKilometerRule && maximum != null) {
                errors.put(
                        prefix + ".maxDistanceKm",
                        "must be null unless an additional-kilometer rule follows the fixed bands"
                );
            } else if (!finalBand && maximum == null) {
                errors.put(prefix + ".maxDistanceKm", "is required except for the final band");
            }
            if (maximum != null && minimum != null && maximum.compareTo(minimum) <= 0) {
                errors.put(prefix + ".maxDistanceKm", "must be greater than minDistanceKm");
            }

            normalized.add(new TariffBand(minimum, maximum, amount, annualAmount));
            if (maximum != null) {
                expectedMinimum = maximum;
            }
        }
        return List.copyOf(normalized);
    }

    private AdditionalKilometerRule validateAdditionalKilometerRule(
            AdditionalKilometerRule input,
            List<TariffBand> bands,
            Map<String, String> errors
    ) {
        if (input == null) {
            return null;
        }

        BigDecimal threshold = normalizeNumber(input.startsAfterDistanceKm());
        if (threshold == null) {
            errors.put("tariff.additionalKilometerRule.startsAfterDistanceKm", "is required");
        } else if (threshold.signum() <= 0) {
            errors.put(
                    "tariff.additionalKilometerRule.startsAfterDistanceKm",
                    "must be greater than zero"
            );
        }

        BigDecimal monthlyAmount = validateKurus(
                input.monthlyAmountPerKilometerKurus(),
                "tariff.additionalKilometerRule.monthlyAmountPerKilometerKurus",
                true,
                errors
        );

        if (!bands.isEmpty()) {
            BigDecimal finalMaximum = bands.getLast().maxDistanceKm();
            if (threshold != null
                    && finalMaximum != null
                    && threshold.compareTo(finalMaximum) != 0) {
                errors.put(
                        "tariff.additionalKilometerRule.startsAfterDistanceKm",
                        "must equal the final fixed band's maximum"
                );
            }
        }
        return new AdditionalKilometerRule(threshold, monthlyAmount);
    }

    private List<String> validateNotes(List<String> input, Map<String, String> errors) {
        if (input == null) {
            return List.of();
        }
        if (input.size() > MAX_NOTES) {
            errors.put("tariff.notes", "must contain at most " + MAX_NOTES + " notes");
            return List.of();
        }

        List<String> normalized = new ArrayList<>(input.size());
        for (int index = 0; index < input.size(); index++) {
            String note = required(
                    input.get(index),
                    "tariff.notes[" + index + "]",
                    1_000,
                    errors
            );
            normalized.add(note == null ? "" : note);
        }
        return List.copyOf(normalized);
    }

    private BigDecimal validateKurus(
            BigDecimal input,
            String field,
            boolean required,
            Map<String, String> errors
    ) {
        BigDecimal amount = normalizeNumber(input);
        if (amount == null) {
            if (required) {
                errors.put(field, "is required");
            }
            return null;
        }

        boolean integral = amount.stripTrailingZeros().scale() <= 0;
        boolean withinLongRange = amount.compareTo(BigDecimal.valueOf(Long.MAX_VALUE)) <= 0;
        if (amount.signum() < 0) {
            errors.put(field, "must be nonnegative");
        }
        if (!integral) {
            errors.put(field, "must be an integer kuruş amount");
        }
        if (!withinLongRange) {
            errors.put(field, "is too large");
        }
        if (amount.signum() >= 0 && integral && withinLongRange) {
            return BigDecimal.valueOf(amount.longValueExact());
        }
        return amount;
    }

    private BigDecimal normalizeNumber(BigDecimal value) {
        if (value == null || value.signum() == 0) {
            return value == null ? null : BigDecimal.ZERO;
        }
        return value.stripTrailingZeros();
    }

    private String required(
            String value,
            String field,
            int maximumLength,
            Map<String, String> errors
    ) {
        String normalized = trim(value);
        if (normalized == null) {
            errors.put(field, "is required");
        } else if (normalized.length() > maximumLength) {
            errors.put(field, "must contain at most " + maximumLength + " characters");
        }
        return normalized;
    }

    private String trim(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
