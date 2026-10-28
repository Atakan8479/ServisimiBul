package com.servisimibul.backend.tariff.service;

import com.servisimibul.backend.tariff.dto.TariffDtos.AdditionalKilometerRule;
import com.servisimibul.backend.tariff.dto.TariffDtos.TariffBand;
import com.servisimibul.backend.tariff.dto.TariffDtos.TariffDocument;
import com.servisimibul.backend.tariff.exception.TariffApiException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TariffValidatorTests {

    private final TariffValidator validator = new TariffValidator();

    @Test
    void normalizesValidOfficialTariff() {
        TariffDocument normalized = validator.validateAndNormalize(document(
                " 34 ",
                " v1 ",
                List.of(
                        band("0.00", "3.0", "120000"),
                        band("3", null, "150000.0")
                )
        ));

        assertThat(normalized.provinceCode()).isEqualTo("34");
        assertThat(normalized.version()).isEqualTo("v1");
        assertThat(normalized.currency()).isEqualTo("TRY");
        assertThat(normalized.bands().getFirst().minDistanceKm()).isEqualByComparingTo("0");
        assertThat(normalized.bands().getLast().amountKurus()).isEqualByComparingTo("150000");
        assertThat(normalized.bands().getLast().amountKurus().scale()).isZero();
    }

    @Test
    void rejectsGapsOverlapsAndNonIntegerKurus() {
        assertThatThrownBy(() -> validator.validateAndNormalize(document(
                "34",
                "v1",
                List.of(
                        band("0", "3", "120000"),
                        band("4", null, "150000.25")
                )
        )))
                .isInstanceOfSatisfying(TariffApiException.class, exception -> {
                    assertThat(exception.code()).isEqualTo("validation_error");
                    assertThat(exception.fieldErrors())
                            .containsKeys(
                                    "tariff.bands[1].minDistanceKm",
                                    "tariff.bands[1].amountKurus"
                            );
                });
    }

    @Test
    void acceptsAnnualAmountsAndSeparateAdditionalKilometerRuleWithoutAnEndDate() {
        TariffDocument normalized = validator.validateAndNormalize(new TariffDocument(
                "34",
                "İstanbul",
                "İBB Meclisi",
                "2026-2027",
                "TRY",
                LocalDate.of(2026, 7, 20),
                null,
                "Official tariff",
                "https://tuhim.ibb.gov.tr/tariff.pdf",
                "2026-2027-ibb-813",
                new AdditionalKilometerRule(new BigDecimal("25.0"), new BigDecimal("8799.0")),
                List.of(" KDV dahil azami tarifedir. "),
                List.of(
                        new TariffBand(
                                BigDecimal.ZERO,
                                BigDecimal.ONE,
                                new BigDecimal("445600.0"),
                                new BigDecimal("3997000.0")
                        ),
                        new TariffBand(
                                BigDecimal.ONE,
                                new BigDecimal("25"),
                                new BigDecimal("1043600"),
                                new BigDecimal("9361000")
                        )
                )
        ));

        assertThat(normalized.effectiveTo()).isNull();
        assertThat(normalized.notes()).containsExactly("KDV dahil azami tarifedir.");
        assertThat(normalized.additionalKilometerRule().startsAfterDistanceKm())
                .isEqualByComparingTo("25");
        assertThat(normalized.additionalKilometerRule().monthlyAmountPerKilometerKurus())
                .isEqualByComparingTo("8799");
        assertThat(normalized.bands()).allSatisfy(
                band -> assertThat(band.annualAmountKurus()).isNotNull()
        );
    }

    @Test
    void rejectsPartialAnnualTableAndMismatchedAdditionalKilometerThreshold() {
        TariffDocument invalid = new TariffDocument(
                "34",
                "İstanbul",
                "İBB Meclisi",
                "2026-2027",
                "TRY",
                LocalDate.of(2026, 7, 20),
                null,
                "Official tariff",
                "https://tuhim.ibb.gov.tr/tariff.pdf",
                "v2",
                new AdditionalKilometerRule(new BigDecimal("26"), new BigDecimal("8799.5")),
                List.of(),
                List.of(
                        new TariffBand(
                                BigDecimal.ZERO,
                                BigDecimal.ONE,
                                new BigDecimal("445600"),
                                new BigDecimal("3997000")
                        ),
                        new TariffBand(
                                BigDecimal.ONE,
                                new BigDecimal("25"),
                                new BigDecimal("1043600"),
                                null
                        )
                )
        );

        assertThatThrownBy(() -> validator.validateAndNormalize(invalid))
                .isInstanceOfSatisfying(TariffApiException.class, exception -> assertThat(exception.fieldErrors())
                        .containsKeys(
                                "tariff.bands[1].annualAmountKurus",
                                "tariff.additionalKilometerRule.startsAfterDistanceKm",
                                "tariff.additionalKilometerRule.monthlyAmountPerKilometerKurus"
                        ));
    }

    @Test
    void rejectsInvalidMetadataAndClosedFinalBand() {
        TariffDocument invalid = new TariffDocument(
                "99",
                "Istanbul",
                "UKOME",
                "2026-2027",
                "EUR",
                LocalDate.of(2027, 9, 1),
                LocalDate.of(2026, 8, 31),
                "Official tariff",
                "http://example.com/tariff",
                "../v1",
                List.of(band("0", "10", "100000"))
        );

        assertThatThrownBy(() -> validator.validateAndNormalize(invalid))
                .isInstanceOfSatisfying(TariffApiException.class, exception -> assertThat(exception.fieldErrors())
                        .containsKeys(
                                "tariff.provinceCode",
                                "tariff.currency",
                                "tariff.effectiveTo",
                                "tariff.officialSourceUrl",
                                "tariff.version",
                                "tariff.bands[0].maxDistanceKm"
                        ));
    }

    private TariffDocument document(String provinceCode, String version, List<TariffBand> bands) {
        return new TariffDocument(
                provinceCode,
                " Istanbul ",
                " IBB UKOME ",
                " 2026-2027 ",
                " try ",
                LocalDate.of(2026, 9, 1),
                LocalDate.of(2027, 8, 31),
                " Official tariff ",
                " https://example.gov.tr/tariff ",
                version,
                bands
        );
    }

    private TariffBand band(String minimum, String maximum, String amount) {
        return new TariffBand(
                new BigDecimal(minimum),
                maximum == null ? null : new BigDecimal(maximum),
                new BigDecimal(amount)
        );
    }
}
