package com.servisimibul.backend.tariff.storage;

import com.servisimibul.backend.tariff.config.TariffProperties;
import com.servisimibul.backend.tariff.dto.TariffDtos.TariffBand;
import com.servisimibul.backend.tariff.dto.TariffDtos.TariffDocument;
import com.servisimibul.backend.tariff.service.TariffValidator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import static org.assertj.core.api.Assertions.assertThat;

class TariffBackupRestoreVerificationTests {

    private static final String ACTION_PROPERTY = "sb.a13.tariff.action";
    private static final String DIRECTORY_PROPERTY = "sb.a13.tariff.directory";

    @TempDir
    private Path temporaryDirectory;

    @Test
    void verifiesTariffBackupRestoreAndRollbackAsANewVersion() throws Exception {
        String action = System.getProperty(ACTION_PROPERTY);
        if ("seed".equals(action)) {
            seed(Path.of(requiredProperty(DIRECTORY_PROPERTY)));
            return;
        }
        if ("verify-and-rollback".equals(action)) {
            verifyAndRollback(Path.of(requiredProperty(DIRECTORY_PROPERTY)));
            return;
        }
        assertThat(action).as("supported A-13 tariff action").isNull();

        Path source = temporaryDirectory.resolve("source");
        Path backup = temporaryDirectory.resolve("backup");
        Path restored = temporaryDirectory.resolve("restored");
        seed(source);
        Map<String, byte[]> sourceManifest = snapshot(source);
        copyTree(source, backup);
        assertThat(snapshot(backup)).containsExactlyEntriesOf(sourceManifest);
        copyTree(backup, restored);
        assertThat(snapshot(restored)).containsExactlyEntriesOf(sourceManifest);
        verifyAndRollback(restored);
    }

    private void seed(Path storageDirectory) throws IOException {
        FileTariffStore store = store(storageDirectory);
        store.replace("34", null, document("a13-v1", 120_000));
        store.replace("34", "a13-v1", document("a13-v2", 130_000));

        assertThat(store.current("34").version()).isEqualTo("a13-v2");
        assertThat(storageDirectory.resolve("34/versions/version-a13-v1.json")).isRegularFile();
        assertThat(storageDirectory.resolve("34/versions/version-a13-v2.json")).isRegularFile();
    }

    private void verifyAndRollback(Path storageDirectory) throws IOException {
        FileTariffStore store = store(storageDirectory);
        Path firstVersion = storageDirectory.resolve("34/versions/version-a13-v1.json");
        Path secondVersion = storageDirectory.resolve("34/versions/version-a13-v2.json");
        byte[] originalV1 = Files.readAllBytes(firstVersion);
        byte[] originalV2 = Files.readAllBytes(secondVersion);

        assertThat(store.current("34").version()).isEqualTo("a13-v2");
        store.replace("34", "a13-v2", document("a13-rollback-v1", 120_000));

        assertThat(store.current("34").version()).isEqualTo("a13-rollback-v1");
        assertThat(store.current("34").bands().getFirst().amountKurus())
                .isEqualByComparingTo("120000");
        assertThat(Files.readAllBytes(firstVersion)).isEqualTo(originalV1);
        assertThat(Files.readAllBytes(secondVersion)).isEqualTo(originalV2);
        assertThat(storageDirectory.resolve("34/versions/version-a13-rollback-v1.json"))
                .isRegularFile();
    }

    private FileTariffStore store(Path storageDirectory) {
        return new FileTariffStore(
                new TariffProperties(storageDirectory.toString()),
                JsonMapper.builder().build(),
                new TariffValidator()
        );
    }

    private TariffDocument document(String version, long amountKurus) {
        return new TariffDocument(
                "34",
                "Istanbul",
                "IBB UKOME",
                "2026-2027",
                "TRY",
                LocalDate.of(2026, 9, 1),
                LocalDate.of(2027, 8, 31),
                "A-13 recovery drill tariff",
                "https://example.gov.tr/a13-tariff",
                version,
                List.of(
                        new TariffBand(BigDecimal.ZERO, BigDecimal.valueOf(3), BigDecimal.valueOf(amountKurus)),
                        new TariffBand(
                                BigDecimal.valueOf(3),
                                null,
                                BigDecimal.valueOf(amountKurus + 10_000)
                        )
                )
        );
    }

    private String requiredProperty(String propertyName) {
        String value = System.getProperty(propertyName);
        assertThat(value).as(propertyName).isNotBlank();
        return value;
    }

    private Map<String, byte[]> snapshot(Path root) throws IOException {
        Map<String, byte[]> files = new TreeMap<>();
        try (var paths = Files.walk(root)) {
            paths.filter(Files::isRegularFile).forEach(path -> {
                try {
                    files.put(root.relativize(path).toString().replace('\\', '/'), Files.readAllBytes(path));
                } catch (IOException exception) {
                    throw new IllegalStateException(exception);
                }
            });
        }
        return files;
    }

    private void copyTree(Path source, Path destination) throws IOException {
        try (var paths = Files.walk(source)) {
            for (Path path : paths.toList()) {
                Path target = destination.resolve(source.relativize(path));
                if (Files.isDirectory(path)) {
                    Files.createDirectories(target);
                } else {
                    Files.copy(path, target, StandardCopyOption.COPY_ATTRIBUTES);
                }
            }
        }
    }
}
