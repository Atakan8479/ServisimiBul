package com.servisimibul.backend.datarights;

import com.servisimibul.backend.datarights.DataRightsDtos.AccessResponse;
import com.servisimibul.backend.datarights.DataRightsDtos.ExcludedDataCategory;
import com.servisimibul.backend.datarights.DataRightsDtos.PersonalDataSection;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Builds a handler worksheet from an explicit allow-list. Every query is scoped directly to
 * the verified subject; credentials, sessions, other users and protected moderation material
 * are impossible to select by construction.
 */
@Component
@RequiredArgsConstructor
class PersonalDataAccessAssembler {

    private static final List<SectionQuery> SECTIONS = List.of(
            section("ACCOUNT", """
                    select id, email, role, is_enabled as "enabled",
                           email_verified_at as "emailVerifiedAt", created_at as "createdAt",
                           updated_at as "updatedAt", deactivated_at as "deactivatedAt"
                    from app_user where id = :subjectId
                    """),
            section("PENDING_EMAIL_CHANGE", """
                    select id, proposed_email as "proposedEmail", expires_at as "expiresAt",
                           consumed_at as "consumedAt", created_at as "createdAt"
                    from pending_email_change where user_id = :subjectId
                    """),
            section("OPERATOR_PROFILE", """
                    select id, business_name as "businessName", contact_phone as "contactPhone",
                           description, approval_status as "approvalStatus", is_active as "active",
                           is_publicly_visible as "publiclyVisible", created_at as "createdAt",
                           updated_at as "updatedAt"
                    from operator_profile where user_id = :subjectId
                    """),
            section("OPERATOR_APPLICATION_REVIEWS", """
                    select review.id, review.decision, review.reviewed_at as "reviewedAt"
                    from operator_application_review review
                    join operator_profile profile on profile.id = review.operator_id
                    where profile.user_id = :subjectId
                    order by review.reviewed_at, review.id
                    """),
            section("OPERATOR_SCHOOLS", """
                    select relation.id, relation.is_active as "active", school.id as "schoolId",
                           school.name as "schoolName"
                    from operator_school relation
                    join operator_profile profile on profile.id = relation.operator_id
                    join school on school.id = relation.school_id
                    where profile.user_id = :subjectId
                    order by relation.id
                    """),
            section("OPERATOR_COVERAGE", """
                    select coverage.id, relation.id as "operatorSchoolId",
                           neighborhood.id as "neighborhoodId", neighborhood.name as "neighborhoodName",
                           district.name as "districtName", province.name as "provinceName"
                    from operator_school_coverage coverage
                    join operator_school relation on relation.id = coverage.operator_school_id
                    join operator_profile profile on profile.id = relation.operator_id
                    join neighborhood on neighborhood.id = coverage.neighborhood_id
                    join district on district.id = neighborhood.district_id
                    join province on province.id = district.province_id
                    where profile.user_id = :subjectId
                    order by coverage.id
                    """),
            section("VEHICLES", """
                    select vehicle.id, vehicle.plate, vehicle.capacity, vehicle.is_active as "active",
                           vehicle.created_at as "createdAt", vehicle.updated_at as "updatedAt"
                    from vehicle
                    join operator_profile profile on profile.id = vehicle.operator_id
                    where profile.user_id = :subjectId
                    order by vehicle.created_at, vehicle.id
                    """),
            section("SERVICE_OFFERINGS", """
                    select offering.id, offering.operator_school_id as "operatorSchoolId",
                           offering.vehicle_id as "vehicleId", offering.available_seats as "availableSeats",
                           offering.description, offering.is_published as "published",
                           offering.created_at as "createdAt", offering.updated_at as "updatedAt"
                    from service_offering offering
                    join operator_school relation on relation.id = offering.operator_school_id
                    join operator_profile profile on profile.id = relation.operator_id
                    where profile.user_id = :subjectId
                    order by offering.created_at, offering.id
                    """),
            section("SERVICE_OFFERING_COVERAGE", """
                    select link.service_offering_id as "serviceOfferingId",
                           general.neighborhood_id as "neighborhoodId"
                    from service_offering_coverage link
                    join service_offering offering on offering.id = link.service_offering_id
                    join operator_school relation on relation.id = offering.operator_school_id
                    join operator_profile profile on profile.id = relation.operator_id
                    join operator_school_coverage general on general.id = link.operator_school_coverage_id
                    where profile.user_id = :subjectId
                    order by link.service_offering_id, general.neighborhood_id
                    """),
            section("CREATED_DEMANDS", """
                    select demand.id, demand.academic_year as "academicYear", demand.status,
                           demand.closure_reason as "closureReason", demand.closed_at as "closedAt",
                           school.id as "schoolId", school.name as "schoolName",
                           neighborhood.id as "neighborhoodId", neighborhood.name as "neighborhoodName",
                           demand.created_at as "createdAt", demand.updated_at as "updatedAt"
                    from demand
                    join school on school.id = demand.school_id
                    join neighborhood on neighborhood.id = demand.neighborhood_id
                    where demand.created_by = :subjectId
                    order by demand.created_at, demand.id
                    """),
            section("DEMAND_LIFECYCLE", """
                    select event.id, event.demand_id as "demandId", event.event_type as "eventType",
                           event.occurred_at as "occurredAt"
                    from demand_lifecycle_event event
                    join demand on demand.id = event.demand_id
                    where demand.created_by = :subjectId
                    order by event.occurred_at, event.id
                    """),
            section("DEMAND_SUPPORTS", """
                    select support.id, support.demand_id as "demandId",
                           support.needs_morning as "needsMorning",
                           support.needs_afternoon as "needsAfternoon", support.status,
                           support.created_at as "createdAt", support.updated_at as "updatedAt"
                    from demand_support support
                    where support.parent_id = :subjectId
                    order by support.created_at, support.id
                    """),
            section("DEMAND_SUPPORT_REASONS", """
                    select reason.support_id as "supportId", reason.reason_code as "reason"
                    from demand_support_reason reason
                    join demand_support support on support.id = reason.support_id
                    where support.parent_id = :subjectId
                    order by reason.support_id, reason.reason_code
                    """),
            section("DEMAND_FEEDBACK", """
                    select feedback.id, feedback.support_id as "supportId",
                           feedback.publication_event_id as "publicationEventId", feedback.status,
                           feedback.opened_at as "openedAt", feedback.reminder_due_at as "reminderDueAt",
                           feedback.reminder_triggered_at as "reminderTriggeredAt",
                           feedback.expires_at as "expiresAt", feedback.evaluated_at as "evaluatedAt",
                           feedback.created_at as "createdAt", feedback.updated_at as "updatedAt"
                    from demand_service_feedback feedback
                    join demand_support support on support.id = feedback.support_id
                    where support.parent_id = :subjectId
                    order by feedback.created_at, feedback.id
                    """),
            section("SERVICE_RESPONSES", """
                    select response.id, response.demand_id as "demandId",
                           response.operator_school_id as "operatorSchoolId",
                           response.offers_morning as "offersMorning",
                           response.offers_afternoon as "offersAfternoon", response.status,
                           response.publication_version as "publicationVersion",
                           response.published_at as "publishedAt", response.withdrawn_at as "withdrawnAt",
                           response.created_at as "createdAt", response.updated_at as "updatedAt"
                    from demand_service_response response
                    join operator_profile profile on profile.id = response.operator_id
                    where profile.user_id = :subjectId
                    order by response.created_at, response.id
                    """),
            section("SERVICE_PUBLICATION_EVENTS", """
                    select event.id, event.response_id as "responseId",
                           event.publication_version as "publicationVersion",
                           event.offers_morning as "offersMorning",
                           event.offers_afternoon as "offersAfternoon",
                           event.published_at as "publishedAt"
                    from demand_service_publication_event event
                    join demand_service_response response on response.id = event.response_id
                    join operator_profile profile on profile.id = response.operator_id
                    where profile.user_id = :subjectId
                    order by event.published_at, event.id
                    """),
            section("COMMENTS", """
                    select id, demand_id as "demandId", author_role as "authorRole", body, status,
                           created_at as "createdAt", updated_at as "updatedAt"
                    from demand_comment where author_id = :subjectId
                    order by created_at, id
                    """),
            section("SUBMITTED_REPORTS", """
                    select report.id, moderation.target_type as "targetType", report.reporter_role as "reporterRole",
                           report.reason, report.explanation, report.created_at as "createdAt"
                    from content_report report
                    join moderation_case moderation on moderation.id = report.moderation_case_id
                    where report.reporter_id = :subjectId
                    order by report.created_at, report.id
                    """),
            section("NOTIFICATIONS", """
                    select id, type, created_at as "createdAt", read_at as "readAt"
                    from in_app_notification where recipient_user_id = :subjectId
                    order by created_at, id
                    """),
            section("NOTIFICATION_PREFERENCES", """
                    select type, enabled, updated_at as "updatedAt"
                    from notification_preference where user_id = :subjectId
                    order by type
                    """),
            section("DATA_RIGHTS_REQUESTS", """
                    select id, request_type as "type", details, status, received_at as "receivedAt",
                           response_due_at as "responseDueAt", identity_verified_at as "identityVerifiedAt",
                           closed_at as "closedAt", response_delivered_at as "responseDeliveredAt",
                           updated_at as "updatedAt"
                    from data_rights_request where requester_id = :subjectId
                    order by received_at, id
                    """)
    );

    private static final List<ExcludedDataCategory> EXCLUSIONS = List.of(
            new ExcludedDataCategory("CREDENTIALS_AND_TOKENS",
                    "Password hashes and one-time token hashes are security secrets, not response content."),
            new ExcludedDataCategory("SESSIONS",
                    "Session identifiers, security context and CSRF values are security secrets."),
            new ExcludedDataCategory("PROTECTED_MODERATION_MATERIAL",
                    "Other users' reports, target snapshots, handler identities and internal decision notes require separate review."),
            new ExcludedDataCategory("INFRASTRUCTURE_LOGS_AND_BACKUPS",
                    "Host logs and backup copies are not queried by the application database response."),
            new ExcludedDataCategory("OTHER_PEOPLE",
                    "Records owned by or addressed to another account are excluded from every query.")
    );

    private final NamedParameterJdbcOperations jdbc;
    private final Clock clock;

    AccessResponse assemble(UUID requestId, UUID subjectId) {
        Map<String, ?> parameters = Map.of("subjectId", subjectId);
        List<PersonalDataSection> sections = SECTIONS.stream()
                .map(section -> new PersonalDataSection(
                        section.category(),
                        jdbc.queryForList(section.sql(), parameters).stream()
                                .map(PersonalDataAccessAssembler::normalize)
                                .toList()))
                .toList();
        return new AccessResponse(
                requestId,
                subjectId,
                OffsetDateTime.now(clock),
                sections,
                EXCLUSIONS
        );
    }

    private static Map<String, Object> normalize(Map<String, Object> row) {
        Map<String, Object> normalized = new LinkedHashMap<>();
        row.forEach((key, value) -> normalized.put(key,
                value instanceof Timestamp timestamp
                        ? timestamp.toInstant().atOffset(ZoneOffset.UTC)
                        : value));
        return Collections.unmodifiableMap(normalized);
    }

    private static SectionQuery section(String category, String sql) {
        return new SectionQuery(category, sql);
    }

    private record SectionQuery(String category, String sql) {
    }
}
