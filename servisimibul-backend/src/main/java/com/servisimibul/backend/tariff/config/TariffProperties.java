package com.servisimibul.backend.tariff.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("servisimibul.tariff")
public record TariffProperties(String storageDir) {
}
