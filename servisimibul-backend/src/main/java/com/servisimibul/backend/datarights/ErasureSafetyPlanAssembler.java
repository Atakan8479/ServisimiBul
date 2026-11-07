package com.servisimibul.backend.datarights;

import com.servisimibul.backend.datarights.DataRightsDtos.ErasureReference;
import com.servisimibul.backend.datarights.DataRightsDtos.ErasureSafetyPlan;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** Builds a count-only plan. It cannot mutate or anonymize subject data. */
@Component
@RequiredArgsConstructor
public class ErasureSafetyPlanAssembler {

    private static final List<String> BLOCKERS = List.of("LEG-03", "LEG-07");
    private static final Map<String, ReferenceRule> RULES = rules();
    private static final String FOREIGN_KEYS = """
            select constraints.constraint_name, columns.table_name, columns.column_name, constraints.delete_rule
            from information_schema.referential_constraints constraints
            join information_schema.key_column_usage columns
              on columns.constraint_schema = constraints.constraint_schema
             and columns.constraint_name = constraints.constraint_name
            where constraints.constraint_schema = current_schema()
              and constraints.unique_constraint_name = 'app_user_pkey'
            order by constraints.constraint_name
            """;

    private final JdbcTemplate jdbc;
    private final Clock clock;

    public ErasureSafetyPlan assemble(UUID requestId, UUID subjectId) {
        Map<String, DatabaseForeignKey> actual = jdbc.query(FOREIGN_KEYS, result -> {
            Map<String, DatabaseForeignKey> keys = new LinkedHashMap<>();
            while (result.next()) {
                var key = new DatabaseForeignKey(
                        result.getString("constraint_name"),
                        result.getString("table_name"),
                        result.getString("column_name"),
                        result.getString("delete_rule")
                );
                keys.put(key.constraint(), key);
            }
            return keys;
        });
        requireExactSchema(actual);
        List<ErasureReference> references = RULES.values().stream()
                .map(rule -> rule.view(jdbc.queryForObject(rule.countSql(), Long.class, subjectId)))
                .toList();
        return new ErasureSafetyPlan(
                requestId,
                OffsetDateTime.now(clock).truncatedTo(ChronoUnit.MICROS),
                false,
                BLOCKERS,
                references
        );
    }

    private static void requireExactSchema(Map<String, DatabaseForeignKey> actual) {
        Set<String> unexpected = actual.keySet().stream()
                .filter(constraint -> !RULES.containsKey(constraint))
                .collect(Collectors.toSet());
        Set<String> missing = RULES.keySet().stream()
                .filter(constraint -> !actual.containsKey(constraint))
                .collect(Collectors.toSet());
        boolean mismatch = RULES.values().stream().anyMatch(rule -> {
            DatabaseForeignKey key = actual.get(rule.constraint());
            return key != null && (!key.table().equals(rule.table())
                    || !key.column().equals(rule.column())
                    || !key.deleteRule().equals(rule.deleteRule()));
        });
        if (!unexpected.isEmpty() || !missing.isEmpty() || mismatch) {
            throw DataRightsApiException.conflict(
                    "erasure_plan_schema_drift",
                    "Account relationships changed; the erasure safety plan must be reviewed"
            );
        }
    }

    private static Map<String, ReferenceRule> rules() {
        Map<String, ReferenceRule> rules = new LinkedHashMap<>();
        add(rules, "operator_profile_user_fk", "operator_profile", "user_id", "RESTRICT",
                "ACCOUNT_PRIVATE", "REVIEW_BEFORE_DETACH_OR_ANONYMIZE");
        add(rules, "email_verification_token_user_fk", "email_verification_token", "user_id", "RESTRICT",
                "ACCOUNT_PRIVATE", "REVIEW_BEFORE_DETACH_OR_ANONYMIZE");
        add(rules, "password_reset_token_user_fk", "password_reset_token", "user_id", "RESTRICT",
                "ACCOUNT_PRIVATE", "REVIEW_BEFORE_DETACH_OR_ANONYMIZE");
        add(rules, "pending_email_change_user_fk", "pending_email_change", "user_id", "RESTRICT",
                "ACCOUNT_PRIVATE", "REVIEW_BEFORE_DETACH_OR_ANONYMIZE");

        add(rules, "demand_created_by_fk", "demand", "created_by", "RESTRICT",
                "SHARED_THIRD_PARTY", "PRESERVE_RECORD_REVIEW_SUBJECT_LINK");
        add(rules, "demand_support_parent_fk", "demand_support", "parent_id", "RESTRICT",
                "SHARED_THIRD_PARTY", "PRESERVE_RECORD_REVIEW_SUBJECT_LINK");
        add(rules, "demand_comment_author_fk", "demand_comment", "author_id", "RESTRICT",
                "SHARED_THIRD_PARTY", "PRESERVE_RECORD_REVIEW_SUBJECT_LINK");
        add(rules, "content_report_reporter_fk", "content_report", "reporter_id", "RESTRICT",
                "SHARED_THIRD_PARTY", "PRESERVE_RECORD_REVIEW_SUBJECT_LINK");

        add(rules, "operator_application_review_reviewer_fk", "operator_application_review", "reviewed_by",
                "RESTRICT", "SECURITY_AUDIT", "PRESERVE_AUDIT_PENDING_RETENTION_RULE");
        add(rules, "moderation_case_moderator_fk", "moderation_case", "moderated_by", "RESTRICT",
                "SECURITY_AUDIT", "PRESERVE_AUDIT_PENDING_RETENTION_RULE");
        add(rules, "moderation_audit_moderator_fk", "moderation_audit_event", "moderator_id", "RESTRICT",
                "SECURITY_AUDIT", "PRESERVE_AUDIT_PENDING_RETENTION_RULE");
        add(rules, "data_rights_handler_user_fk", "data_rights_handler", "user_id", "CASCADE",
                "SECURITY_AUDIT", "REVIEW_DEPENDENT_CASCADE");
        add(rules, "data_rights_request_requester_fk", "data_rights_request", "requester_id", "NO ACTION",
                "SECURITY_AUDIT", "PRESERVE_AUDIT_PENDING_RETENTION_RULE");
        add(rules, "data_rights_request_handler_fk", "data_rights_request", "assigned_handler_id", "NO ACTION",
                "SECURITY_AUDIT", "PRESERVE_AUDIT_PENDING_RETENTION_RULE");
        add(rules, "data_rights_request_verifier_fk", "data_rights_request", "identity_verified_by", "NO ACTION",
                "SECURITY_AUDIT", "PRESERVE_AUDIT_PENDING_RETENTION_RULE");
        add(rules, "data_rights_request_event_actor_fk", "data_rights_request_event", "actor_id", "NO ACTION",
                "SECURITY_AUDIT", "PRESERVE_AUDIT_PENDING_RETENTION_RULE");
        add(rules, "data_rights_request_event_previous_assignee_fk", "data_rights_request_event",
                "previous_assignee_id", "NO ACTION", "SECURITY_AUDIT", "PRESERVE_AUDIT_PENDING_RETENTION_RULE");
        add(rules, "data_rights_request_event_new_assignee_fk", "data_rights_request_event", "new_assignee_id",
                "NO ACTION", "SECURITY_AUDIT", "PRESERVE_AUDIT_PENDING_RETENTION_RULE");

        add(rules, "in_app_notification_recipient_fk", "in_app_notification", "recipient_user_id", "CASCADE",
                "DELIVERY_PREFERENCE", "REVIEW_DEPENDENT_CASCADE");
        add(rules, "notification_preference_user_fk", "notification_preference", "user_id", "CASCADE",
                "DELIVERY_PREFERENCE", "REVIEW_DEPENDENT_CASCADE");
        return Collections.unmodifiableMap(new LinkedHashMap<>(rules));
    }

    private static void add(
            Map<String, ReferenceRule> rules,
            String constraint,
            String table,
            String column,
            String deleteRule,
            String classification,
            String handling
    ) {
        rules.put(constraint, new ReferenceRule(
                constraint, table, column, deleteRule, classification, handling,
                "select count(*) from " + table + " where " + column + " = ?"
        ));
    }

    private record DatabaseForeignKey(String constraint, String table, String column, String deleteRule) {
    }

    private record ReferenceRule(
            String constraint,
            String table,
            String column,
            String deleteRule,
            String classification,
            String handling,
            String countSql
    ) {
        ErasureReference view(Long count) {
            return new ErasureReference(
                    constraint, table, column, deleteRule, classification, handling, count == null ? 0 : count
            );
        }
    }
}
