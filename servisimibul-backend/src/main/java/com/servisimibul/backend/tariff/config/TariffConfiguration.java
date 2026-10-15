package com.servisimibul.backend.tariff.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(TariffProperties.class)
class TariffConfiguration {
}
