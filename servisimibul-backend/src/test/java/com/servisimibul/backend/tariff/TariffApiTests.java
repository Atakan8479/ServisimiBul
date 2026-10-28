package com.servisimibul.backend.tariff;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Path;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class TariffApiTests {

    private static final Path TARIFF_DIRECTORY = Path.of(
            System.getProperty("java.io.tmpdir"),
            "servisimibul-tariff-api-" + UUID.randomUUID()
    );

    @DynamicPropertySource
    static void tariffProperties(DynamicPropertyRegistry registry) {
        registry.add("servisimibul.tariff.storage-dir", TARIFF_DIRECTORY::toString);
    }

    private final MockMvc mockMvc;

    @Autowired
    TariffApiTests(MockMvc mockMvc) {
        this.mockMvc = mockMvc;
    }

    @Test
    void adminCanCreateAndAnonymousReadIsSessionless() throws Exception {
        mockMvc.perform(put("/api/v1/admin/tariffs/34")
                        .with(user("admin").roles("ADMIN"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateJson(null, "34", "v1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.provinceCode").value("34"))
                .andExpect(jsonPath("$.version").value("v1"));

        var result = mockMvc.perform(get("/api/v1/tariffs").param("provinceCode", "34"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authority").value("IBB UKOME"))
                .andExpect(jsonPath("$.bands[0].amountKurus").value(120000))
                .andReturn();

        assertThat(result.getRequest().getSession(false)).isNull();
    }

    @Test
    void staleReplacementReturnsStableConflictAndKeepsCurrent() throws Exception {
        replaceAsAdmin("06", null, "v1").andExpect(status().isOk());

        replaceAsAdmin("06", "stale", "v2")
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("tariff_version_conflict"));

        mockMvc.perform(get("/api/v1/tariffs").param("provinceCode", "06"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value("v1"));
    }

    @Test
    void extendedAnnualAndAdditionalKilometerContractRoundTrips() throws Exception {
        mockMvc.perform(put("/api/v1/admin/tariffs/41")
                        .with(user("admin").roles("ADMIN"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(extendedUpdateJson()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.effectiveTo").isEmpty())
                .andExpect(jsonPath("$.bands[0].annualAmountKurus").value(9_000_000))
                .andExpect(jsonPath("$.additionalKilometerRule.startsAfterDistanceKm").value(25))
                .andExpect(jsonPath("$.additionalKilometerRule.monthlyAmountPerKilometerKurus").value(1_234))
                .andExpect(jsonPath("$.notes[0]").value("KDV dahil azami tarifedir."));

        mockMvc.perform(get("/api/v1/tariffs").param("provinceCode", "41"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value("extended-v1"))
                .andExpect(jsonPath("$.bands[0].maxDistanceKm").value(25));
    }

    @Test
    void pathIdentityAndBandContractAreValidated() throws Exception {
        mockMvc.perform(put("/api/v1/admin/tariffs/35")
                        .with(user("admin").roles("ADMIN"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateJson(null, "34", "v1")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("validation_error"))
                .andExpect(jsonPath("$.fieldErrors['tariff.provinceCode']").exists());

        mockMvc.perform(put("/api/v1/admin/tariffs/35")
                        .with(user("admin").roles("ADMIN"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidBandJson()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors['tariff.bands[1].minDistanceKm']").exists())
                .andExpect(jsonPath("$.fieldErrors['tariff.bands[1].amountKurus']").exists());
    }

    @Test
    void nonAdminAndMissingCsrfCannotReplaceTariffs() throws Exception {
        mockMvc.perform(put("/api/v1/admin/tariffs/07")
                        .with(user("operator").roles("OPERATOR"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateJson(null, "07", "v1")))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/v1/admin/tariffs/07")
                        .with(user("admin").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateJson(null, "07", "v1")))
                .andExpect(status().isForbidden());
    }

    @Test
    void missingTariffUsesSafeProblemDetails() throws Exception {
        mockMvc.perform(get("/api/v1/tariffs").param("provinceCode", "08"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("tariff_not_found"));
    }

    private org.springframework.test.web.servlet.ResultActions replaceAsAdmin(
            String provinceCode,
            String expectedVersion,
            String version
    ) throws Exception {
        return mockMvc.perform(put("/api/v1/admin/tariffs/{provinceCode}", provinceCode)
                .with(user("admin").roles("ADMIN"))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(updateJson(expectedVersion, provinceCode, version)));
    }

    private String updateJson(String expectedVersion, String provinceCode, String version) {
        String expectedVersionJson = expectedVersion == null ? "null" : "\"" + expectedVersion + "\"";
        return """
                {
                  "expectedVersion": %s,
                  "tariff": {
                    "provinceCode": "%s",
                    "provinceName": "Istanbul",
                    "authority": "IBB UKOME",
                    "academicYear": "2026-2027",
                    "currency": "TRY",
                    "effectiveFrom": "2026-09-01",
                    "effectiveTo": "2027-08-31",
                    "sourceTitle": "Synthetic contract fixture",
                    "officialSourceUrl": "https://fixtures.invalid/tariff",
                    "version": "%s",
                    "bands": [
                      {"minDistanceKm": 0, "maxDistanceKm": 3, "amountKurus": 120000},
                      {"minDistanceKm": 3, "maxDistanceKm": null, "amountKurus": 150000}
                    ]
                  }
                }
                """.formatted(expectedVersionJson, provinceCode, version);
    }

    private String invalidBandJson() {
        return """
                {
                  "expectedVersion": null,
                  "tariff": {
                    "provinceCode": "35",
                    "provinceName": "Izmir",
                    "authority": "UKOME",
                    "academicYear": "2026-2027",
                    "currency": "TRY",
                    "effectiveFrom": "2026-09-01",
                    "effectiveTo": "2027-08-31",
                    "sourceTitle": "Synthetic extended contract fixture",
                    "officialSourceUrl": "https://fixtures.invalid/extended-tariff",
                    "version": "v1",
                    "bands": [
                      {"minDistanceKm": 0, "maxDistanceKm": 3, "amountKurus": 120000},
                      {"minDistanceKm": 4, "maxDistanceKm": null, "amountKurus": 150000.25}
                    ]
                  }
                }
                """;
    }

    private String extendedUpdateJson() {
        return """
                {
                  "expectedVersion": null,
                  "tariff": {
                    "provinceCode": "41",
                    "provinceName": "Kocaeli",
                    "authority": "UKOME",
                    "academicYear": "2026-2027",
                    "currency": "TRY",
                    "effectiveFrom": "2026-07-20",
                    "effectiveTo": null,
                    "sourceTitle": "Official tariff",
                    "officialSourceUrl": "https://example.gov.tr/tariff",
                    "version": "extended-v1",
                    "additionalKilometerRule": {
                      "startsAfterDistanceKm": 25,
                      "monthlyAmountPerKilometerKurus": 1234
                    },
                    "notes": ["KDV dahil azami tarifedir."],
                    "bands": [
                      {
                        "minDistanceKm": 0,
                        "maxDistanceKm": 25,
                        "amountKurus": 1000000,
                        "annualAmountKurus": 9000000
                      }
                    ]
                  }
                }
                """;
    }
}
