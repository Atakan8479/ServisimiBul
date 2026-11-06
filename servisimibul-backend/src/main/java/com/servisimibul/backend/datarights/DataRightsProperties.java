package com.servisimibul.backend.datarights;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Fail-closed switch: stays false until LEG-06 (#199) approves the channel and process. */
@ConfigurationProperties("app.data-rights")
public record DataRightsProperties(boolean enabled) {
}
