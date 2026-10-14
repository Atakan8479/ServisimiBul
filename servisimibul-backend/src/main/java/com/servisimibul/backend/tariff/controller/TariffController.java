package com.servisimibul.backend.tariff.controller;

import com.servisimibul.backend.tariff.dto.TariffDtos.TariffDocument;
import com.servisimibul.backend.tariff.dto.TariffDtos.TariffUpdateRequest;
import com.servisimibul.backend.tariff.service.TariffService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class TariffController {

    private final TariffService tariffService;

    @GetMapping("/tariffs")
    public TariffDocument current(@RequestParam String provinceCode) {
        return tariffService.current(provinceCode);
    }

    @PutMapping("/admin/tariffs/{provinceCode}")
    public TariffDocument replace(
            @PathVariable String provinceCode,
            @RequestBody TariffUpdateRequest request
    ) {
        return tariffService.replace(provinceCode, request);
    }
}
