package com.servisimibul.backend.tariff.service;

import com.servisimibul.backend.tariff.dto.TariffDtos.TariffDocument;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OfficialIstanbulTariffTests {

    private static final List<Long> MONTHLY_AMOUNTS = List.of(
            445_600L,
            477_200L,
            515_700L,
            537_900L,
            567_100L,
            656_900L,
            756_100L,
            794_200L,
            857_300L,
            906_400L,
            964_500L,
            1_004_600L,
            1_043_600L
    );
    private static final List<Long> ANNUAL_AMOUNTS = List.of(
            3_997_000L,
            4_280_400L,
            4_625_800L,
            4_824_900L,
            5_086_800L,
            5_892_300L,
            6_782_200L,
            7_123_900L,
            7_689_900L,
            8_130_400L,
            8_651_500L,
            9_011_200L,
            9_361_000L
    );

    private final TariffValidator validator = new TariffValidator();

    @Test
    void canonicalDocumentMatchesEveryOfficialRowAndCondition() throws IOException {
        TariffDocument tariff = validator.validateAndNormalize(readCanonicalDocument());

        assertThat(tariff.provinceCode()).isEqualTo("34");
        assertThat(tariff.academicYear()).isEqualTo("2026-2027");
        assertThat(tariff.effectiveFrom()).isEqualTo(LocalDate.of(2026, 7, 20));
        assertThat(tariff.effectiveTo()).isNull();
        assertThat(tariff.version()).isEqualTo("2026-2027-ibb-813");
        assertThat(tariff.officialSourceUrl()).startsWith("https://tuhim.ibb.gov.tr/");
        assertThat(tariff.bands()).hasSize(13);
        assertThat(tariff.bands()).extracting(band -> band.amountKurus().longValueExact())
                .containsExactlyElementsOf(MONTHLY_AMOUNTS);
        assertThat(tariff.bands()).extracting(band -> band.annualAmountKurus().longValueExact())
                .containsExactlyElementsOf(ANNUAL_AMOUNTS);
        assertThat(tariff.bands().getFirst().minDistanceKm()).isEqualByComparingTo("0");
        assertThat(tariff.bands().getFirst().maxDistanceKm()).isEqualByComparingTo("1");
        assertThat(tariff.bands().getLast().minDistanceKm()).isEqualByComparingTo("23");
        assertThat(tariff.bands().getLast().maxDistanceKm()).isEqualByComparingTo("25");
        assertThat(tariff.notes()).hasSize(17);
    }

    @Test
    void additionalKilometerRuleStartsAfterTheFinalFixedBand() throws IOException {
        TariffDocument tariff = validator.validateAndNormalize(readCanonicalDocument());
        BigDecimal baseMonthlyAmount = tariff.bands().getLast().amountKurus();
        BigDecimal surcharge = tariff.additionalKilometerRule().monthlyAmountPerKilometerKurus();

        assertThat(tariff.additionalKilometerRule().startsAfterDistanceKm())
                .isEqualByComparingTo("25");
        assertThat(monthlyAmountAtWholeKilometers(baseMonthlyAmount, surcharge, 25))
                .isEqualByComparingTo("1043600");
        assertThat(monthlyAmountAtWholeKilometers(baseMonthlyAmount, surcharge, 26))
                .isEqualByComparingTo("1052399");
        assertThat(monthlyAmountAtWholeKilometers(baseMonthlyAmount, surcharge, 30))
                .isEqualByComparingTo("1087595");
    }

    private TariffDocument readCanonicalDocument() throws IOException {
        try (var stream = getClass().getResourceAsStream(
                "/tariff/official/istanbul-2026-2027.json"
        )) {
            assertThat(stream).isNotNull();
            return JsonMapper.builder().build()
                    .readerFor(TariffDocument.class)
                    .with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                    .readValue(stream);
        }
    }

    private BigDecimal monthlyAmountAtWholeKilometers(
            BigDecimal baseMonthlyAmount,
            BigDecimal surcharge,
            int distanceKm
    ) {
        int additionalKilometers = Math.max(0, distanceKm - 25);
        return baseMonthlyAmount.add(surcharge.multiply(BigDecimal.valueOf(additionalKilometers)));
    }
}
