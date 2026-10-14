package com.servisimibul.backend.tariff.storage;

import com.servisimibul.backend.tariff.config.TariffProperties;
import com.servisimibul.backend.tariff.dto.TariffDtos.TariffBand;
import com.servisimibul.backend.tariff.dto.TariffDtos.TariffDocument;
import com.servisimibul.backend.tariff.exception.TariffApiException;
import com.servisimibul.backend.tariff.service.TariffValidator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FileTariffStoreTests {

    @TempDir
    private Path storageDirectory;

    @Test
    void createsImmutableVersionsAndKeepsCurrentComplete() throws Exception {
        FileTariffStore store = store();
        TariffDocument v1 = document("34", "v1", 120_000);
        TariffDocument v2 = document("34", "v2", 130_000);

        store.replace("34", null, v1);
        store.replace("34", "v1", v2);

        assertThat(store.current("34").version()).isEqualTo("v2");
        assertThat(storageDirectory.resolve("34/current.json")).isRegularFile();
        assertThat(storageDirectory.resolve("34/versions/version-v1.json")).isRegularFile();
        assertThat(storageDirectory.resolve("34/versions/version-v2.json")).isRegularFile();
        assertThat(Files.readString(storageDirectory.resolve("34/versions/version-v1.json")))
                .contains("\"version\" : \"v1\"");
    }

    @Test
    void rejectedUpdateWritesNothingAndPreservesCurrent() throws Exception {
        FileTariffStore store = store();
        store.replace("34", null, document("34", "v1", 120_000));

        assertThatThrownBy(() -> store.replace("34", "stale", document("34", "v2", 130_000)))
                .isInstanceOfSatisfying(
                        TariffApiException.class,
                        exception -> assertThat(exception.code()).isEqualTo("tariff_version_conflict")
                );

        assertThat(store.current("34").version()).isEqualTo("v1");
        try (var versions = Files.list(storageDirectory.resolve("34/versions"))) {
            assertThat(versions).hasSize(1);
        }
    }

    @Test
    void missingStorageConfigurationFailsWithoutExposingAPath() {
        FileTariffStore store = new FileTariffStore(
                new TariffProperties(" "),
                JsonMapper.builder().build(),
                new TariffValidator()
        );

        assertThatThrownBy(() -> store.current("34"))
                .isInstanceOfSatisfying(TariffApiException.class, exception -> {
                    assertThat(exception.code()).isEqualTo("tariff_storage_unavailable");
                    assertThat(exception.getMessage()).doesNotContain(storageDirectory.toString());
                });
    }

    @Test
    void concurrentReplacementsAllowExactlyOneWinner() throws Exception {
        FileTariffStore store = store();
        store.replace("34", null, document("34", "v1", 120_000));

        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<String> first = executor.submit(
                    () -> attemptReplace(store, ready, start, document("34", "v2-a", 130_000))
            );
            Future<String> second = executor.submit(
                    () -> attemptReplace(store, ready, start, document("34", "v2-b", 140_000))
            );
            ready.await();
            start.countDown();

            assertThat(List.of(first.get(), second.get()))
                    .containsExactlyInAnyOrder("success", "tariff_version_conflict");
        }

        assertThat(store.current("34").version()).isIn("v2-a", "v2-b");
        try (var versions = Files.list(storageDirectory.resolve("34/versions"))) {
            assertThat(versions).hasSize(2);
        }
    }

    private String attemptReplace(
            FileTariffStore store,
            CountDownLatch ready,
            CountDownLatch start,
            TariffDocument replacement
    ) throws InterruptedException {
        ready.countDown();
        start.await();
        try {
            store.replace("34", "v1", replacement);
            return "success";
        } catch (TariffApiException exception) {
            return exception.code();
        }
    }

    private FileTariffStore store() {
        return new FileTariffStore(
                new TariffProperties(storageDirectory.toString()),
                JsonMapper.builder().build(),
                new TariffValidator()
        );
    }

    private TariffDocument document(String provinceCode, String version, long amountKurus) {
        return new TariffDocument(
                provinceCode,
                "Istanbul",
                "IBB UKOME",
                "2026-2027",
                "TRY",
                LocalDate.of(2026, 9, 1),
                LocalDate.of(2027, 8, 31),
                "Official tariff",
                "https://example.gov.tr/tariff",
                version,
                List.of(
                        new TariffBand(BigDecimal.ZERO, BigDecimal.valueOf(3), BigDecimal.valueOf(amountKurus)),
                        new TariffBand(BigDecimal.valueOf(3), null, BigDecimal.valueOf(amountKurus + 10_000))
                )
        );
    }
}
