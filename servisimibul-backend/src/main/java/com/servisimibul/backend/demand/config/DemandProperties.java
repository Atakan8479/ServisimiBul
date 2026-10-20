package com.servisimibul.backend.demand.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.demand")
public record DemandProperties(String academicYear) {

    public DemandProperties {
        if (academicYear == null || !academicYear.matches("[0-9]{4}-[0-9]{4}")) {
            throw new IllegalArgumentException("app.demand.academic-year must use YYYY-YYYY format");
        }
        int start = Integer.parseInt(academicYear.substring(0, 4));
        int end = Integer.parseInt(academicYear.substring(5));
        if (end != start + 1) {
            throw new IllegalArgumentException("app.demand.academic-year must contain consecutive years");
        }
    }
}
