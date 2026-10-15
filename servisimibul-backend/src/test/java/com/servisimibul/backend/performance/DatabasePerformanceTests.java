package com.servisimibul.backend.performance;

import com.servisimibul.backend.discovery.dto.PublicOperatorDtos.OperatorResponse;
import com.servisimibul.backend.discovery.dto.PublicOperatorDtos.PageResponse;
import com.servisimibul.backend.discovery.service.PublicOperatorDiscoveryService;
import com.servisimibul.backend.identity.OperatorApprovalStatus;
import com.servisimibul.backend.operatorapplication.service.OperatorApplicationService;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@Transactional
@Sql("/db/performance/a08_pilot_dataset.sql")
class DatabasePerformanceTests {

    private static final UUID TARGET_SCHOOL_ID = UUID.fromString(
            "a07da0b7-5fa9-b70e-3ece-f452e7abbd36"
    );
    private static final long TARGET_NEIGHBORHOOD_ID = 991001L;
    private static final Pattern EXECUTION_TIME = Pattern.compile(
            "Execution Time: ([0-9.]+) ms"
    );
    private static final double CI_QUERY_SAFETY_CEILING_MILLIS = 500.0;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Autowired
    private PublicOperatorDiscoveryService discoveryService;

    @Autowired
    private OperatorApplicationService applicationService;

    @Test
    void recordsPilotScalePlansAndGuardsQueryShapeAndStablePagination() {
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from operator_profile", Integer.class
        )).isEqualTo(2000);
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from operator_school_coverage", Integer.class
        )).isEqualTo(20000);
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from service_offering_coverage", Integer.class
        )).isEqualTo(12000);

        recordCriticalQueryPlans();
        assertConstantDiscoveryQueryCount();
        assertConstantAdminQueueQueryCount();
        assertStableDiscoveryPagination();
    }

    private void recordCriticalQueryPlans() {
        assertPlanWithinCeiling("discovery-page", """
                select distinct profile.id,
                                profile.business_name,
                                profile.contact_phone,
                                profile.description
                from operator_profile profile
                join app_user account on account.id = profile.user_id
                where account.email_verified_at is not null
                  and account.is_enabled = true
                  and account.role = 'OPERATOR'
                  and profile.approval_status = 'APPROVED'
                  and profile.is_active = true
                  and profile.is_publicly_visible = true
                  and exists (
                      select 1
                      from operator_school_coverage coverage
                      join operator_school relationship
                        on relationship.id = coverage.operator_school_id
                      join school matched_school on matched_school.id = relationship.school_id
                      where relationship.operator_id = profile.id
                        and relationship.is_active = true
                        and matched_school.is_active = true
                        and matched_school.id = ?
                        and coverage.neighborhood_id = ?
                  )
                order by profile.business_name nulls last, profile.id
                limit 50 offset 0
                """, TARGET_SCHOOL_ID, TARGET_NEIGHBORHOOD_ID);

        assertPlanWithinCeiling("discovery-count", """
                select count(distinct profile.id)
                from operator_profile profile
                join app_user account on account.id = profile.user_id
                where account.email_verified_at is not null
                  and account.is_enabled = true
                  and account.role = 'OPERATOR'
                  and profile.approval_status = 'APPROVED'
                  and profile.is_active = true
                  and profile.is_publicly_visible = true
                  and exists (
                      select 1
                      from operator_school_coverage coverage
                      join operator_school relationship
                        on relationship.id = coverage.operator_school_id
                      join school matched_school on matched_school.id = relationship.school_id
                      where relationship.operator_id = profile.id
                        and relationship.is_active = true
                        and matched_school.is_active = true
                        and matched_school.id = ?
                        and coverage.neighborhood_id = ?
                  )
                """, TARGET_SCHOOL_ID, TARGET_NEIGHBORHOOD_ID);

        List<UUID> operatorIds = discoveryService.search(
                TARGET_SCHOOL_ID,
                TARGET_NEIGHBORHOOD_ID,
                0,
                50
        ).content().stream().map(OperatorResponse::operatorId).toList();
        String placeholders = String.join(",", operatorIds.stream().map(ignored -> "?").toList());
        List<Object> offeringArguments = new ArrayList<>(operatorIds);
        offeringArguments.add(TARGET_SCHOOL_ID);
        offeringArguments.add(TARGET_NEIGHBORHOOD_ID);
        assertPlanWithinCeiling("offering-enrichment", """
                select relationship.operator_id,
                       offering.id,
                       offering.available_seats,
                       vehicle.capacity,
                       offering.description
                from service_offering_coverage offering_coverage
                join service_offering offering
                  on offering.id = offering_coverage.service_offering_id
                join operator_school relationship
                  on relationship.id = offering.operator_school_id
                join school matched_school on matched_school.id = relationship.school_id
                join vehicle vehicle on vehicle.id = offering.vehicle_id
                join operator_school_coverage general_coverage
                  on general_coverage.id = offering_coverage.operator_school_coverage_id
                where relationship.operator_id in (%s)
                  and offering.is_published = true
                  and relationship.is_active = true
                  and matched_school.is_active = true
                  and matched_school.id = ?
                  and vehicle.is_active = true
                  and vehicle.operator_id = relationship.operator_id
                  and general_coverage.operator_school_id = relationship.id
                  and general_coverage.neighborhood_id = ?
                order by relationship.operator_id, offering.created_at, offering.id
                """.formatted(placeholders), offeringArguments.toArray());

        assertPlanWithinCeiling("admin-application-queue", """
                select profile.id,
                       profile.business_name,
                       profile.contact_phone,
                       profile.description,
                       profile.approval_status,
                       profile.is_active,
                       profile.is_publicly_visible,
                       profile.created_at,
                       profile.updated_at
                from operator_profile profile
                where profile.approval_status = 'PENDING'
                order by profile.created_at, profile.id
                limit 50 offset 0
                """);

        assertPlanWithinCeiling("admin-application-count", """
                select count(*)
                from operator_profile profile
                where profile.approval_status = 'PENDING'
                """);
    }

    private void assertConstantDiscoveryQueryCount() {
        Statistics statistics = statistics();
        statistics.clear();

        PageResponse<OperatorResponse> response = discoveryService.search(
                TARGET_SCHOOL_ID,
                TARGET_NEIGHBORHOOD_ID,
                0,
                50
        );

        assertThat(response.content()).hasSize(50);
        assertThat(response.totalElements()).isEqualTo(120);
        assertThat(statistics.getPrepareStatementCount()).isEqualTo(5);
    }

    private void assertConstantAdminQueueQueryCount() {
        Statistics statistics = statistics();
        statistics.clear();

        var response = applicationService.queue(OperatorApprovalStatus.PENDING, 0, 50);

        assertThat(response.content()).hasSize(50);
        assertThat(response.totalElements()).isEqualTo(500);
        assertThat(statistics.getPrepareStatementCount()).isEqualTo(2);
    }

    private void assertStableDiscoveryPagination() {
        List<UUID> firstPass = collectAllDiscoveryIds(25);
        List<UUID> secondPass = collectAllDiscoveryIds(25);

        assertThat(firstPass).hasSize(120);
        assertThat(new HashSet<>(firstPass)).hasSize(120);
        assertThat(secondPass).containsExactlyElementsOf(firstPass);
    }

    private List<UUID> collectAllDiscoveryIds(int pageSize) {
        List<UUID> ids = new ArrayList<>();
        int page = 0;
        int totalPages;
        do {
            PageResponse<OperatorResponse> response = discoveryService.search(
                    TARGET_SCHOOL_ID,
                    TARGET_NEIGHBORHOOD_ID,
                    page,
                    pageSize
            );
            ids.addAll(response.content().stream().map(OperatorResponse::operatorId).toList());
            totalPages = response.totalPages();
            page++;
        } while (page < totalPages);
        return ids;
    }

    private void assertPlanWithinCeiling(String name, String sql, Object... arguments) {
        String plan = String.join(System.lineSeparator(), jdbcTemplate.query(
                "explain (analyze, buffers, format text) " + sql,
                (resultSet, rowNumber) -> resultSet.getString(1),
                arguments
        ));
        System.out.printf(Locale.ROOT, "%nA08 PLAN [%s]%n%s%n", name, plan);

        Matcher matcher = EXECUTION_TIME.matcher(plan);
        assertThat(matcher.find()).as("execution time is present for %s", name).isTrue();
        double executionMillis = Double.parseDouble(matcher.group(1));
        assertThat(executionMillis)
                .as("%s execution time", name)
                .isLessThan(CI_QUERY_SAFETY_CEILING_MILLIS);
    }

    private Statistics statistics() {
        return entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    }
}
