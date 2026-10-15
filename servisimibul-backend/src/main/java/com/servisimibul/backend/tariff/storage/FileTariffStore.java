package com.servisimibul.backend.tariff.storage;

import com.servisimibul.backend.tariff.config.TariffProperties;
import com.servisimibul.backend.tariff.dto.TariffDtos.TariffDocument;
import com.servisimibul.backend.tariff.exception.TariffApiException;
import com.servisimibul.backend.tariff.service.TariffValidator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

@Component
@RequiredArgsConstructor
public class FileTariffStore {

    private static final long MAX_TARIFF_FILE_BYTES = 1_000_000;

    private final TariffProperties properties;
    private final ObjectMapper objectMapper;
    private final TariffValidator validator;
    private final ConcurrentMap<String, Lock> provinceLocks = new ConcurrentHashMap<>();

    public TariffDocument current(String provinceCode) {
        Path currentFile = provinceDirectory(provinceCode).resolve("current.json");
        if (!Files.isRegularFile(currentFile)) {
            throw TariffApiException.notFound(provinceCode);
        }
        return readAndValidate(currentFile, provinceCode);
    }

    public TariffDocument replace(
            String provinceCode,
            String expectedVersion,
            TariffDocument replacement
    ) {
        Lock lock = provinceLocks.computeIfAbsent(provinceCode, ignored -> new ReentrantLock());
        lock.lock();
        try {
            return replaceWhileLocked(provinceCode, expectedVersion, replacement);
        } finally {
            lock.unlock();
        }
    }

    private TariffDocument replaceWhileLocked(
            String provinceCode,
            String expectedVersion,
            TariffDocument replacement
    ) {
        Path provinceDirectory = provinceDirectory(provinceCode);
        Path currentFile = provinceDirectory.resolve("current.json");
        Path versionsDirectory = provinceDirectory.resolve("versions");

        TariffDocument current = Files.isRegularFile(currentFile)
                ? readAndValidate(currentFile, provinceCode)
                : null;
        String currentVersion = current == null ? null : current.version();
        if (!Objects.equals(expectedVersion, currentVersion)) {
            throw TariffApiException.versionConflict();
        }
        if (Objects.equals(replacement.version(), currentVersion)) {
            throw TariffApiException.validation(
                    java.util.Map.of("tariff.version", "must differ from the current version")
            );
        }

        Path versionFile = versionsDirectory.resolve("version-" + replacement.version() + ".json");
        Path versionTemp = null;
        Path currentTemp = null;
        boolean versionInstalled = false;
        try {
            Files.createDirectories(versionsDirectory);
            if (Files.exists(versionFile)) {
                throw TariffApiException.versionConflict();
            }

            byte[] documentBytes = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(replacement);
            verifySerializedDocument(documentBytes, provinceCode, replacement.version());

            versionTemp = Files.createTempFile(versionsDirectory, ".tariff-version-", ".tmp");
            writeNewFile(versionTemp, documentBytes);
            moveAtomically(versionTemp, versionFile, false);
            versionTemp = null;
            versionInstalled = true;

            currentTemp = Files.createTempFile(provinceDirectory, ".tariff-current-", ".tmp");
            writeNewFile(currentTemp, documentBytes);
            moveAtomically(currentTemp, currentFile, true);
            currentTemp = null;
            return replacement;
        } catch (TariffApiException exception) {
            cleanupRejectedWrite(versionTemp, currentTemp, versionFile, versionInstalled);
            throw exception;
        } catch (IOException | RuntimeException exception) {
            cleanupRejectedWrite(versionTemp, currentTemp, versionFile, versionInstalled);
            throw TariffApiException.storageUnavailable();
        }
    }

    private TariffDocument readAndValidate(Path file, String provinceCode) {
        try {
            if (Files.size(file) > MAX_TARIFF_FILE_BYTES) {
                throw TariffApiException.invalidStoredDocument();
            }
            byte[] bytes = Files.readAllBytes(file);
            TariffDocument document = strictRead(bytes);
            TariffDocument normalized = validator.validateAndNormalize(document);
            if (!provinceCode.equals(normalized.provinceCode())) {
                throw TariffApiException.invalidStoredDocument();
            }
            return normalized;
        } catch (TariffApiException exception) {
            if ("validation_error".equals(exception.code())) {
                throw TariffApiException.invalidStoredDocument();
            }
            throw exception;
        } catch (IOException | RuntimeException exception) {
            throw TariffApiException.invalidStoredDocument();
        }
    }

    private void verifySerializedDocument(byte[] bytes, String provinceCode, String expectedVersion) {
        try {
            TariffDocument serialized = validator.validateAndNormalize(strictRead(bytes));
            if (!provinceCode.equals(serialized.provinceCode())
                    || !expectedVersion.equals(serialized.version())) {
                throw TariffApiException.storageUnavailable();
            }
        } catch (IOException exception) {
            throw TariffApiException.storageUnavailable();
        }
    }

    private TariffDocument strictRead(byte[] bytes) throws IOException {
        return objectMapper.readerFor(TariffDocument.class)
                .with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                .readValue(bytes);
    }

    private void writeNewFile(Path path, byte[] bytes) throws IOException {
        Files.write(path, bytes, StandardOpenOption.TRUNCATE_EXISTING, StandardOpenOption.WRITE);
    }

    private void moveAtomically(Path source, Path target, boolean replaceExisting) throws IOException {
        try {
            if (replaceExisting) {
                Files.move(
                        source,
                        target,
                        StandardCopyOption.ATOMIC_MOVE,
                        StandardCopyOption.REPLACE_EXISTING
                );
            } else {
                Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
            }
        } catch (AtomicMoveNotSupportedException exception) {
            throw new IOException("The tariff volume does not support atomic replacement", exception);
        }
    }

    private void cleanupRejectedWrite(
            Path versionTemp,
            Path currentTemp,
            Path versionFile,
            boolean versionInstalled
    ) {
        deleteQuietly(versionTemp);
        deleteQuietly(currentTemp);
        if (versionInstalled) {
            deleteQuietly(versionFile);
        }
    }

    private void deleteQuietly(Path path) {
        if (path == null) {
            return;
        }
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // The original safe API failure is more useful than a cleanup error.
        }
    }

    private Path provinceDirectory(String provinceCode) {
        String configuredDirectory = properties.storageDir();
        if (configuredDirectory == null || configuredDirectory.isBlank()) {
            throw TariffApiException.storageUnavailable();
        }
        Path root;
        try {
            root = Path.of(configuredDirectory).toAbsolutePath().normalize();
        } catch (RuntimeException exception) {
            throw TariffApiException.storageUnavailable();
        }
        Path provinceDirectory = root.resolve(provinceCode).normalize();
        if (!provinceDirectory.startsWith(root)) {
            throw TariffApiException.storageUnavailable();
        }
        return provinceDirectory;
    }
}
