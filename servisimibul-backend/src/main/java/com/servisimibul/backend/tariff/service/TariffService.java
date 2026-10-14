package com.servisimibul.backend.tariff.service;

import com.servisimibul.backend.tariff.dto.TariffDtos.TariffDocument;
import com.servisimibul.backend.tariff.dto.TariffDtos.TariffUpdateRequest;
import com.servisimibul.backend.tariff.exception.TariffApiException;
import com.servisimibul.backend.tariff.storage.FileTariffStore;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class TariffService {

    private final TariffValidator validator;
    private final FileTariffStore tariffStore;

    public TariffDocument current(String provinceCode) {
        String normalizedProvinceCode = validator.normalizeProvinceCode(provinceCode, "provinceCode");
        return tariffStore.current(normalizedProvinceCode);
    }

    public TariffDocument replace(String provinceCode, TariffUpdateRequest request) {
        String normalizedProvinceCode = validator.normalizeProvinceCode(provinceCode, "provinceCode");
        if (request == null) {
            throw TariffApiException.validation(Map.of("request", "is required"));
        }
        TariffDocument replacement = validator.validateAndNormalize(request.tariff());
        if (!normalizedProvinceCode.equals(replacement.provinceCode())) {
            throw TariffApiException.validation(
                    Map.of("tariff.provinceCode", "must match the provinceCode path value")
            );
        }
        String expectedVersion = normalizeExpectedVersion(request.expectedVersion());
        return tariffStore.replace(normalizedProvinceCode, expectedVersion, replacement);
    }

    private String normalizeExpectedVersion(String expectedVersion) {
        if (expectedVersion == null) {
            return null;
        }
        String normalized = expectedVersion.trim();
        if (normalized.isEmpty()) {
            throw TariffApiException.validation(
                    Map.of("expectedVersion", "must be null for creation or contain the version that was read")
            );
        }
        return normalized;
    }
}
