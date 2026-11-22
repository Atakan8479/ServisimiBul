package com.servisimibul.backend.offering;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.health.contributor.Health;
import org.springframework.boot.health.contributor.HealthIndicator;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class VehicleUsageSchemaHealthIndicator implements HealthIndicator {

    private static final String COMPATIBILITY_QUERY = """
            select count(*) filter (
                       where column_name = 'usage_history_complete'
                         and data_type = 'boolean'
                         and is_nullable = 'NO'
                         and column_default = 'true'
                   ) = 1
               and count(*) filter (
                       where column_name = 'usage_recorded_at'
                         and data_type = 'timestamp with time zone'
                         and is_nullable = 'YES'
                         and column_default is null
                   ) = 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'vehicle'
              and column_name in ('usage_history_complete', 'usage_recorded_at')
            """;

    private final JdbcTemplate jdbcTemplate;

    @Override
    public Health health() {
        try {
            Boolean compatible = jdbcTemplate.queryForObject(COMPATIBILITY_QUERY, Boolean.class);
            return Boolean.TRUE.equals(compatible)
                    ? Health.up().build()
                    : Health.down().withDetail("requiredMigration", "V22").build();
        } catch (DataAccessException failure) {
            return Health.down().withDetail("requiredMigration", "V22").build();
        }
    }
}
