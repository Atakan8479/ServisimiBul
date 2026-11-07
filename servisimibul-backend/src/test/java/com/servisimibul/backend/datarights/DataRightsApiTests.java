package com.servisimibul.backend.datarights;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.servisimibul.backend.datarights.DataRightsDtos.ActionRequest;
import com.servisimibul.backend.datarights.DataRightsDtos.SubmitRequest;
import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import com.servisimibul.backend.identity.UserRole;
import com.servisimibul.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Exercises the real mechanism against disposable PostgreSQL with the feature switched on
 * for this context only. Every real environment keeps app.data-rights.enabled=false.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "app.data-rights.enabled=true",
        "spring.datasource.hikari.maximum-pool-size=4"
})
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class DataRightsApiTests {

    private static final String BASE = "/api/v1/data-rights-requests";
    private static final String ADMIN_BASE = "/api/v1/admin/data-rights-requests";
    private static final String DETAILS = "Hakkımda tutulan verileri görmek istiyorum.";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private AppUserRepository userRepository;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private DataRightsService service;

    private final List<UUID> users = new ArrayList<>();
    private final List<UUID> schools = new ArrayList<>();
    private final List<Long> neighborhoods = new ArrayList<>();
    private final List<Long> districts = new ArrayList<>();
    private final List<Long> provinces = new ArrayList<>();

    @AfterEach
    void cleanUp() {
        if (users.isEmpty()) {
            return;
        }
        Object[] ids = users.toArray(UUID[]::new);
        jdbc.update("delete from data_rights_request_event where request_id in "
                + "(select id from data_rights_request where requester_id = any (?))", (Object) ids);
        jdbc.update("delete from data_rights_request_event where actor_id = any (?)", (Object) ids);
        jdbc.update("delete from data_rights_request where requester_id = any (?)", (Object) ids);
        jdbc.update("delete from data_rights_handler where user_id = any (?)", (Object) ids);
        jdbc.update("delete from pending_email_change where user_id = any (?)", (Object) ids);
        jdbc.update("delete from demand where created_by = any (?)", (Object) ids);
        jdbc.update("delete from operator_application_review where operator_id in "
                + "(select id from operator_profile where user_id = any (?))", (Object) ids);
        jdbc.update("delete from operator_profile where user_id = any (?)", (Object) ids);
        jdbc.update("delete from app_user where id = any (?)", (Object) ids);
        users.clear();
        if (!schools.isEmpty()) {
            jdbc.update("delete from school where id = any (?)", (Object) schools.toArray(UUID[]::new));
            jdbc.update("delete from neighborhood where id = any (?)", (Object) neighborhoods.toArray(Long[]::new));
            jdbc.update("delete from district where id = any (?)", (Object) districts.toArray(Long[]::new));
            jdbc.update("delete from province where id = any (?)", (Object) provinces.toArray(Long[]::new));
            schools.clear();
            neighborhoods.clear();
            districts.clear();
            provinces.clear();
        }
    }

    @Test
    void submissionIsRecordedAsReceivedWithMinimalRequesterView() throws Exception {
        AppUser parent = account(UserRole.PARENT);
        OffsetDateTime before = OffsetDateTime.now().truncatedTo(ChronoUnit.MICROS);

        JsonNode view = submit(parent, "ACCESS", DETAILS, HttpStatus.CREATED);

        assertThat(view.get("status").asText()).isEqualTo("RECEIVED");
        assertThat(view.has("details")).isFalse();
        assertThat(view.has("handlerNote")).isFalse();
        assertThat(view.has("assignedHandlerId")).isFalse();
        assertThat(view.has("responseDueAt")).isFalse();
        assertThat(view.get("responseDelivered").asBoolean()).isFalse();
        UUID id = UUID.fromString(view.get("id").asText());
        var row = jdbc.queryForMap(
                "select received_at, response_due_at, requester_id, details from data_rights_request where id = ?", id);
        OffsetDateTime receivedAt = ((java.sql.Timestamp) row.get("received_at")).toInstant()
                .atOffset(java.time.ZoneOffset.UTC);
        assertThat(receivedAt).isAfterOrEqualTo(before);
        assertThat(((java.sql.Timestamp) row.get("response_due_at")).toInstant())
                .isEqualTo(receivedAt.plusDays(30).toInstant());
        assertThat(row.get("requester_id")).isEqualTo(parent.getId());
        assertThat(row.get("details")).isEqualTo(DETAILS);
        assertThat(jdbc.queryForList(
                "select action from data_rights_request_event where request_id = ?", String.class, id))
                .containsExactly("RECEIVE");

        mockMvc.perform(get(BASE).with(as(parent)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(id.toString()));
        mockMvc.perform(get("/api/v1/auth/me").with(as(parent)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dataRightsRequestsAvailable").value(true));
    }

    @Test
    void repeatedErasureSubmissionReturnsTheSameOpenRequest() throws Exception {
        AppUser operator = account(UserRole.OPERATOR);
        JsonNode first = submit(operator, "ERASURE", DETAILS, HttpStatus.CREATED);

        JsonNode duplicate = submit(operator, "ERASURE", "Tekrar", HttpStatus.OK);
        assertThat(duplicate.get("id").asText()).isEqualTo(first.get("id").asText());
        assertThat(duplicate.get("status").asText()).isEqualTo("RECEIVED");
        submit(operator, "CORRECTION", DETAILS, HttpStatus.CREATED);
        JsonNode otherDuplicate = submit(operator, "CORRECTION", "Tekrar", HttpStatus.CONFLICT);
        assertThat(otherDuplicate.get("code").asText()).isEqualTo("duplicate_open_request");

        assertThat(count(operator)).isEqualTo(2);
    }

    @Test
    void erasureRemainsIdempotentUntilOutcomeDeliveryAndThenAllowsANewRequest() throws Exception {
        AppUser parent = account(UserRole.PARENT);
        AppUser handler = handler();
        UUID id = UUID.fromString(submit(parent, "ERASURE", DETAILS, HttpStatus.CREATED).get("id").asText());
        JsonNode detail = act(handler, id, action(DataRightsAction.ASSIGN, 0, handler.getId(), null), HttpStatus.OK);
        detail = act(handler, id, action(DataRightsAction.START_REVIEW, version(detail), null, null), HttpStatus.OK);
        detail = act(handler, id, action(DataRightsAction.RESPOND, version(detail), null, null), HttpStatus.OK);

        mockMvc.perform(get(BASE + "/" + id).with(as(parent)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RESPONDED"))
                .andExpect(jsonPath("$.responseDelivered").value(false));

        SubmitRequest repeated = new SubmitRequest(DataRightsRequestType.ERASURE, "Tekrar");
        List<Object> outcomes = race(
                () -> service.submit(repeated, parent.getId()),
                () -> service.submit(repeated, parent.getId())
        );
        assertThat(outcomes).allSatisfy(outcome -> {
            assertThat(outcome).isInstanceOf(DataRightsService.SubmissionResult.class);
            var result = (DataRightsService.SubmissionResult) outcome;
            assertThat(result.created()).isFalse();
            assertThat(result.request().id()).isEqualTo(id);
            assertThat(result.request().responseDelivered()).isFalse();
        });
        assertThat(count(parent)).isOne();

        act(handler, id, action(DataRightsAction.RECORD_DELIVERY, version(detail), null, null), HttpStatus.OK);
        mockMvc.perform(get(BASE + "/" + id).with(as(parent)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.responseDelivered").value(true));

        DataRightsService.SubmissionResult next = service.submit(repeated, parent.getId());
        assertThat(next.created()).isTrue();
        assertThat(next.request().id()).isNotEqualTo(id);
        assertThat(count(parent)).isEqualTo(2);
    }

    @Test
    void requesterHistoryCanFilterByTypeBeforeApplyingTheFiftyRequestLimit() throws Exception {
        AppUser parent = account(UserRole.PARENT);
        UUID erasureId = UUID.fromString(submit(parent, "ERASURE", DETAILS, HttpStatus.CREATED).get("id").asText());
        OffsetDateTime receivedAt = OffsetDateTime.now().plusMinutes(1).truncatedTo(ChronoUnit.MICROS);
        for (int index = 0; index < 51; index++) {
            OffsetDateTime timestamp = receivedAt.plusMinutes(index);
            jdbc.update("""
                    insert into data_rights_request
                        (id, requester_id, request_type, details, status, received_at, response_due_at,
                         closed_at, response_delivered_at, version, updated_at)
                    values (?, ?, 'OTHER', 'Geçmiş talep', 'RESPONDED', ?, ?, ?, ?, 0, ?)
                    """, UUID.randomUUID(), parent.getId(), timestamp, timestamp.plusDays(30),
                    timestamp, timestamp, timestamp);
        }

        JsonNode mixed = read(mockMvc.perform(get(BASE).with(as(parent)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(50)));
        assertThat(mixed.findValuesAsString("id")).doesNotContain(erasureId.toString());
        mockMvc.perform(get(BASE).param("type", "ERASURE").with(as(parent)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(erasureId.toString()));
        mockMvc.perform(get(BASE).param("type", "UNKNOWN").with(as(parent)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsInvalidInputWithoutEchoingOrPersistingIt() throws Exception {
        AppUser parent = account(UserRole.PARENT);
        String nationalId = "12345678901";

        String body = mockMvc.perform(post(BASE).with(as(parent)).with(csrf())
                        .contentType("application/json")
                        .content(json(new SubmitRequest(DataRightsRequestType.ACCESS, "TC " + nationalId))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.details").exists())
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain(nationalId);

        mockMvc.perform(post(BASE).with(as(parent)).with(csrf())
                        .contentType("application/json")
                        .content("{\"type\":\"ACCESS\",\"details\":\"" + "x".repeat(2001) + "\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(BASE).with(as(parent)).with(csrf())
                        .contentType("application/json")
                        .content("{\"type\":\"UNKNOWN\",\"details\":\"x\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(BASE).with(as(parent)).with(csrf())
                        .contentType("application/json")
                        .content("{\"type\":\"ACCESS\",\"details\":\"   \"}"))
                .andExpect(status().isBadRequest());

        assertThat(count(parent)).isZero();
    }

    @Test
    void requesterEndpointsEnforceAuthenticationRolesCsrfAndOwnership() throws Exception {
        AppUser owner = account(UserRole.PARENT);
        AppUser other = account(UserRole.PARENT);
        AppUser admin = handler();
        UUID id = UUID.fromString(submit(owner, "ACCESS", DETAILS, HttpStatus.CREATED).get("id").asText());

        mockMvc.perform(get(BASE + "/" + id)).andExpect(status().isUnauthorized());
        mockMvc.perform(post(BASE).with(csrf()).contentType("application/json")
                        .content(json(new SubmitRequest(DataRightsRequestType.OTHER, DETAILS))))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post(BASE).with(as(other)).contentType("application/json")
                        .content(json(new SubmitRequest(DataRightsRequestType.OTHER, DETAILS))))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(BASE + "/" + id).with(as(admin))).andExpect(status().isForbidden());

        mockMvc.perform(get(BASE + "/" + id).with(as(other)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("request_not_found"));
        mockMvc.perform(get(BASE).with(as(other)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(get(BASE + "/" + id).with(as(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RECEIVED"));
        assertThat(count(other)).isZero();
    }

    @Test
    void handlingRequiresAdminRoleAndExplicitHandlerDesignation() throws Exception {
        AppUser parent = account(UserRole.PARENT);
        AppUser operator = account(UserRole.OPERATOR);
        AppUser ordinaryAdmin = account(UserRole.ADMIN);
        UUID id = UUID.fromString(submit(parent, "ACCESS", DETAILS, HttpStatus.CREATED).get("id").asText());

        mockMvc.perform(get(ADMIN_BASE)).andExpect(status().isUnauthorized());
        mockMvc.perform(get(ADMIN_BASE).with(as(operator))).andExpect(status().isForbidden());
        mockMvc.perform(get(ADMIN_BASE + "/" + id).with(as(parent))).andExpect(status().isForbidden());
        mockMvc.perform(get(ADMIN_BASE + "/" + id).with(as(ordinaryAdmin)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("handler_required"));
        mockMvc.perform(post(ADMIN_BASE + "/" + id + "/actions").with(as(ordinaryAdmin)).with(csrf())
                        .contentType("application/json")
                        .content(json(action(DataRightsAction.ASSIGN, 0, ordinaryAdmin.getId(), null))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("handler_required"));

        AppUser handler = handler();
        mockMvc.perform(post(ADMIN_BASE + "/" + id + "/actions").with(as(handler))
                        .contentType("application/json")
                        .content(json(action(DataRightsAction.ASSIGN, 0, handler.getId(), null))))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(ADMIN_BASE + "/" + id + "/actions").with(as(handler)).with(csrf())
                        .contentType("application/json")
                        .content(json(action(DataRightsAction.ASSIGN, 0, ordinaryAdmin.getId(), null))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.assigneeId").exists());
        mockMvc.perform(post(ADMIN_BASE + "/" + id + "/actions").with(as(handler)).with(csrf())
                        .contentType("application/json")
                        .content(json(action(DataRightsAction.ASSIGN, 0, operator.getId(), null))))
                .andExpect(status().isBadRequest());

        jdbc.update("update app_user set is_enabled = false where id = ?", handler.getId());
        mockMvc.perform(get(ADMIN_BASE).with(as(handler)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("handler_required"));
    }

    @Test
    void fullHandlingLifecycleIsAuditedAndOnlyTheAssignedHandlerMayAct() throws Exception {
        AppUser parent = account(UserRole.PARENT);
        AppUser handler = handler();
        AppUser colleague = handler();
        UUID id = UUID.fromString(submit(parent, "CORRECTION", DETAILS, HttpStatus.CREATED).get("id").asText());

        JsonNode queued = read(mockMvc.perform(get(ADMIN_BASE).param("status", "RECEIVED").with(as(handler)))
                .andExpect(status().isOk())).get("content");
        assertThat(queued.findValuesAsString("id")).contains(id.toString());
        assertThat(queued.toString()).doesNotContain(DETAILS);

        JsonNode detail = act(handler, id, action(DataRightsAction.ASSIGN, 0, handler.getId(), null), HttpStatus.OK);
        assertThat(detail.get("details").asText()).isEqualTo(DETAILS);
        assertThat(detail.get("assignedHandlerId").asText()).isEqualTo(handler.getId().toString());

        JsonNode notAssigned = act(colleague, id, action(DataRightsAction.START_REVIEW, version(detail), null, null),
                HttpStatus.FORBIDDEN);
        assertThat(notAssigned.get("code").asText()).isEqualTo("handler_not_assigned");

        JsonNode invalid = act(handler, id, action(DataRightsAction.RESPOND, version(detail), null, null),
                HttpStatus.CONFLICT);
        assertThat(invalid.get("code").asText()).isEqualTo("invalid_transition");
        act(handler, id, action(DataRightsAction.RECORD_DELIVERY, version(detail), null, null), HttpStatus.CONFLICT);
        act(handler, id, action(DataRightsAction.START_REVIEW, version(detail), null, "not accepted"),
                HttpStatus.BAD_REQUEST);
        act(handler, id, action(DataRightsAction.REQUEST_VERIFICATION, version(detail), null, null),
                HttpStatus.BAD_REQUEST);
        act(handler, id, action(DataRightsAction.RECEIVE, version(detail), null, null), HttpStatus.BAD_REQUEST);

        detail = act(handler, id, action(DataRightsAction.START_REVIEW, version(detail), null, null), HttpStatus.OK);
        JsonNode stale = act(handler, id, action(DataRightsAction.REQUEST_VERIFICATION, 0, null, "Ek belge"),
                HttpStatus.CONFLICT);
        assertThat(stale.get("code").asText()).isEqualTo("stale_request_version");

        detail = act(handler, id, action(DataRightsAction.REQUEST_VERIFICATION, version(detail), null,
                "Hesap sahipliği teyidi gerekli"), HttpStatus.OK);
        assertThat(detail.get("status").asText()).isEqualTo("AWAITING_VERIFICATION");
        mockMvc.perform(get(BASE + "/" + id).with(as(parent)))
                .andExpect(jsonPath("$.status").value("AWAITING_VERIFICATION"))
                .andExpect(jsonPath("$.handlerNote").doesNotExist());

        detail = act(handler, id, action(DataRightsAction.RECORD_IDENTITY_VERIFIED, version(detail), null, null),
                HttpStatus.OK);
        assertThat(detail.get("identityVerifiedAt").isNull()).isFalse();
        act(handler, id, action(DataRightsAction.RESPOND_PARTIALLY, version(detail), null, null),
                HttpStatus.BAD_REQUEST);
        detail = act(handler, id, action(DataRightsAction.RESPOND_PARTIALLY, version(detail), null,
                "Bir kısmı düzeltildi"), HttpStatus.OK);
        assertThat(detail.get("status").asText()).isEqualTo("PARTIALLY_RESPONDED");
        assertThat(detail.get("closedAt").isNull()).isFalse();
        assertThat(detail.get("responseDeliveredAt").isNull()).isTrue();

        act(handler, id, action(DataRightsAction.REJECT, version(detail), null, "late"), HttpStatus.CONFLICT);
        act(handler, id, action(DataRightsAction.ASSIGN, version(detail), colleague.getId(), null),
                HttpStatus.CONFLICT);
        detail = act(handler, id, action(DataRightsAction.RECORD_DELIVERY, version(detail), null, null),
                HttpStatus.OK);
        assertThat(detail.get("responseDeliveredAt").isNull()).isFalse();
        act(handler, id, action(DataRightsAction.RECORD_DELIVERY, version(detail), null, null), HttpStatus.CONFLICT);

        assertThat(detail.get("events").findValuesAsString("action")).containsExactly(
                "RECEIVE", "ASSIGN", "START_REVIEW", "REQUEST_VERIFICATION", "RECORD_IDENTITY_VERIFIED",
                "RESPOND_PARTIALLY", "RECORD_DELIVERY");
        assertThat(detail.get("events").toString()).doesNotContain(DETAILS).doesNotContain("Bir kısmı");
        mockMvc.perform(get(BASE + "/" + id).with(as(parent)))
                .andExpect(jsonPath("$.status").value("PARTIALLY_RESPONDED"))
                .andExpect(jsonPath("$.closedAt").exists());
    }

    @Test
    void accessResponseRequiresVerifiedIdentityAndExpiresAfterRecordedDelivery() throws Exception {
        AppUser parent = account(UserRole.PARENT);
        AppUser otherParent = account(UserRole.PARENT);
        AppUser handler = handler();
        AppUser colleague = handler();
        String tokenHash = "a".repeat(64);
        jdbc.update("""
                insert into pending_email_change
                    (id, user_id, proposed_email, token_hash, expires_at, created_at)
                values (?, ?, ?, ?, now() + interval '1 day', now())
                """, UUID.randomUUID(), parent.getId(), "new-parent@example.com", tokenHash);
        UUID id = UUID.fromString(submit(parent, "ACCESS", DETAILS, HttpStatus.CREATED).get("id").asText());

        JsonNode detail = act(handler, id, action(DataRightsAction.ASSIGN, 0, handler.getId(), null), HttpStatus.OK);
        detail = act(handler, id, action(DataRightsAction.START_REVIEW, version(detail), null, null), HttpStatus.OK);

        mockMvc.perform(get(ADMIN_BASE + "/" + id + "/access-response").with(as(handler)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("identity_verification_required"));
        mockMvc.perform(get(ADMIN_BASE + "/" + id + "/access-response").with(as(colleague)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("handler_not_assigned"));

        detail = act(handler, id, action(DataRightsAction.RECORD_IDENTITY_VERIFIED, version(detail), null, null),
                HttpStatus.OK);
        String response = mockMvc.perform(get(ADMIN_BASE + "/" + id + "/access-response").with(as(handler)))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")))
                .andExpect(jsonPath("$.requestId").value(id.toString()))
                .andExpect(jsonPath("$.subjectId").value(parent.getId().toString()))
                .andExpect(jsonPath("$.sections[?(@.category == 'ACCOUNT')].records[0].email")
                        .value(parent.getEmail()))
                .andExpect(jsonPath("$.sections[?(@.category == 'PENDING_EMAIL_CHANGE')].records[0].proposedEmail")
                        .value("new-parent@example.com"))
                .andExpect(jsonPath("$.sections[?(@.category == 'DATA_RIGHTS_REQUESTS')].records[0].details")
                        .value(DETAILS))
                .andReturn().getResponse().getContentAsString();

        assertThat(response)
                .doesNotContain(otherParent.getEmail())
                .doesNotContain("password_hash")
                .doesNotContain("passwordHash")
                .doesNotContain("token_hash")
                .doesNotContain(tokenHash)
                .doesNotContain("event_key")
                .doesNotContain("target_snapshot")
                .doesNotContain("decision_reason");

        detail = act(handler, id, action(DataRightsAction.RESPOND, version(detail), null, null), HttpStatus.OK);
        mockMvc.perform(get(ADMIN_BASE + "/" + id + "/access-response").with(as(handler)))
                .andExpect(status().isOk());
        detail = act(handler, id, action(DataRightsAction.RECORD_DELIVERY, version(detail), null, null),
                HttpStatus.OK);
        mockMvc.perform(get(ADMIN_BASE + "/" + id + "/access-response").with(as(handler)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("access_response_expired"));
    }

    @Test
    void accessResponseRejectsNonAccessAndRejectedRequests() throws Exception {
        AppUser parent = account(UserRole.PARENT);
        AppUser handler = handler();
        UUID correction = UUID.fromString(
                submit(parent, "CORRECTION", DETAILS, HttpStatus.CREATED).get("id").asText());
        JsonNode detail = act(handler, correction,
                action(DataRightsAction.ASSIGN, 0, handler.getId(), null), HttpStatus.OK);
        detail = act(handler, correction,
                action(DataRightsAction.START_REVIEW, version(detail), null, null), HttpStatus.OK);
        act(handler, correction,
                action(DataRightsAction.RECORD_IDENTITY_VERIFIED, version(detail), null, null), HttpStatus.OK);

        mockMvc.perform(get(ADMIN_BASE + "/" + correction + "/access-response").with(as(handler)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("access_request_required"));

        UUID rejected = UUID.fromString(submit(parent, "ACCESS", DETAILS, HttpStatus.CREATED).get("id").asText());
        detail = act(handler, rejected, action(DataRightsAction.ASSIGN, 0, handler.getId(), null), HttpStatus.OK);
        detail = act(handler, rejected,
                action(DataRightsAction.START_REVIEW, version(detail), null, null), HttpStatus.OK);
        detail = act(handler, rejected,
                action(DataRightsAction.RECORD_IDENTITY_VERIFIED, version(detail), null, null), HttpStatus.OK);
        act(handler, rejected, action(DataRightsAction.REJECT, version(detail), null, "Kapsam dışı"), HttpStatus.OK);

        mockMvc.perform(get(ADMIN_BASE + "/" + rejected + "/access-response").with(as(handler)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("access_response_unavailable"));
    }

    @Test
    void erasureSafetyPlanIsCountOnlyIdempotentAndPreservesSharedRecordsAfterDeleteRollback() throws Exception {
        AppUser parent = account(UserRole.PARENT);
        AppUser supporter = account(UserRole.PARENT);
        AppUser handler = handler();
        UUID demandId = UUID.randomUUID();
        UUID supportId = UUID.randomUUID();
        String geographyKey = UUID.randomUUID().toString();
        Long provinceId = jdbc.queryForObject(
                "insert into province (code, name) values (?, ?) returning id",
                Long.class, geographyKey.substring(0, 2), "Province " + geographyKey);
        Long districtId = jdbc.queryForObject(
                "insert into district (province_id, name) values (?, ?) returning id",
                Long.class, provinceId, "District " + geographyKey);
        Long neighborhoodId = jdbc.queryForObject(
                "insert into neighborhood (district_id, name) values (?, ?) returning id",
                Long.class, districtId, "Neighborhood " + geographyKey);
        UUID schoolId = UUID.randomUUID();
        jdbc.update("insert into school (id, neighborhood_id, name) values (?, ?, ?)",
                schoolId, neighborhoodId, "School " + geographyKey);
        provinces.add(provinceId);
        districts.add(districtId);
        neighborhoods.add(neighborhoodId);
        schools.add(schoolId);
        jdbc.update("""
                insert into demand
                    (id, school_id, neighborhood_id, academic_year, created_by, status, created_at, updated_at)
                values (?, ?, ?, '2026-2027', ?, 'OPEN', now(), now())
                """, demandId, schoolId, neighborhoodId, parent.getId());
        jdbc.update("""
                insert into demand_support
                    (id, demand_id, parent_id, needs_morning, needs_afternoon, status, created_at, updated_at)
                values (?, ?, ?, true, false, 'ACTIVE', now(), now())
                """, supportId, demandId, supporter.getId());

        UUID requestId = UUID.fromString(submit(parent, "ERASURE", DETAILS, HttpStatus.CREATED).get("id").asText());
        JsonNode detail = act(handler, requestId,
                action(DataRightsAction.ASSIGN, 0, handler.getId(), null), HttpStatus.OK);
        detail = act(handler, requestId,
                action(DataRightsAction.START_REVIEW, version(detail), null, null), HttpStatus.OK);

        mockMvc.perform(get(ADMIN_BASE + "/" + requestId + "/erasure-safety-plan").with(as(handler)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("identity_verification_required"));
        detail = act(handler, requestId,
                action(DataRightsAction.RECORD_IDENTITY_VERIFIED, version(detail), null, null), HttpStatus.OK);

        JsonNode first = read(mockMvc.perform(
                        get(ADMIN_BASE + "/" + requestId + "/erasure-safety-plan").with(as(handler)))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")))
                .andExpect(jsonPath("$.executionAvailable").value(false))
                .andExpect(jsonPath("$.blockers[0]").value("LEG-03"))
                .andExpect(jsonPath("$.blockers[1]").value("LEG-07")));
        JsonNode second = read(mockMvc.perform(
                        get(ADMIN_BASE + "/" + requestId + "/erasure-safety-plan").with(as(handler)))
                .andExpect(status().isOk()));

        assertThat(first.get("references")).isEqualTo(second.get("references"));
        JsonNode demandReference = reference(first, "demand_created_by_fk");
        assertThat(demandReference.get("classification").asText()).isEqualTo("SHARED_THIRD_PARTY");
        assertThat(demandReference.get("handling").asText()).isEqualTo("PRESERVE_RECORD_REVIEW_SUBJECT_LINK");
        assertThat(demandReference.get("rowCount").asLong()).isOne();

        assertThatThrownBy(() -> jdbc.update("delete from app_user where id = ?", parent.getId()))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThat(jdbc.queryForObject("select count(*) from demand where id = ?", Integer.class, demandId)).isOne();
        assertThat(jdbc.queryForObject(
                "select count(*) from demand_support where id = ? and parent_id = ?",
                Integer.class, supportId, supporter.getId())).isOne();

        List<Object> recovered = race(
                () -> service.erasureSafetyPlan(requestId, handler.getId()),
                () -> service.erasureSafetyPlan(requestId, handler.getId())
        );
        assertThat(recovered).allMatch(DataRightsDtos.ErasureSafetyPlan.class::isInstance);
        List<DataRightsDtos.ErasureSafetyPlan> concurrentPlans = recovered.stream()
                .map(DataRightsDtos.ErasureSafetyPlan.class::cast)
                .toList();
        assertThat(concurrentPlans).extracting(DataRightsDtos.ErasureSafetyPlan::requestId)
                .containsOnly(requestId);
        assertThat(concurrentPlans).extracting(DataRightsDtos.ErasureSafetyPlan::executionAvailable)
                .containsOnly(false);
        assertThat(concurrentPlans.get(0).blockers()).isEqualTo(concurrentPlans.get(1).blockers());
        assertThat(concurrentPlans.get(0).references()).isEqualTo(concurrentPlans.get(1).references());
        assertThat(jdbc.queryForObject("select count(*) from demand where id = ?", Integer.class, demandId)).isOne();
        assertThat(jdbc.queryForObject(
                "select count(*) from demand_support where id = ? and parent_id = ?",
                Integer.class, supportId, supporter.getId())).isOne();
    }

    @Test
    void erasureSafetyPlanRejectsWrongTypeAndUnassignedHandler() throws Exception {
        AppUser parent = account(UserRole.PARENT);
        AppUser handler = handler();
        AppUser colleague = handler();
        UUID requestId = UUID.fromString(submit(parent, "ACCESS", DETAILS, HttpStatus.CREATED).get("id").asText());
        JsonNode detail = act(handler, requestId,
                action(DataRightsAction.ASSIGN, 0, handler.getId(), null), HttpStatus.OK);
        detail = act(handler, requestId,
                action(DataRightsAction.START_REVIEW, version(detail), null, null), HttpStatus.OK);
        act(handler, requestId,
                action(DataRightsAction.RECORD_IDENTITY_VERIFIED, version(detail), null, null), HttpStatus.OK);

        mockMvc.perform(get(ADMIN_BASE + "/" + requestId + "/erasure-safety-plan").with(as(colleague)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("handler_not_assigned"));
        mockMvc.perform(get(ADMIN_BASE + "/" + requestId + "/erasure-safety-plan").with(as(handler)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("erasure_request_required"));
    }

    @Test
    void accessResponseIncludesOnlyTheOperatorsOwnProfileAndOmitsProtectedReviewNotes() throws Exception {
        AppUser operator = account(UserRole.OPERATOR);
        AppUser otherOperator = account(UserRole.OPERATOR);
        AppUser handler = handler();
        UUID profileId = UUID.randomUUID();
        UUID otherProfileId = UUID.randomUUID();
        jdbc.update("""
                insert into operator_profile
                    (id, user_id, business_name, contact_phone, description, approval_status,
                     is_active, is_publicly_visible, created_at, updated_at)
                values (?, ?, ?, ?, ?, 'DRAFT', true, true, now(), now()),
                       (?, ?, ?, ?, ?, 'DRAFT', true, true, now(), now())
                """,
                profileId, operator.getId(), "Own Service", "+905551111111", "Own description",
                otherProfileId, otherOperator.getId(), "Other Service", "+905552222222", "Other description");
        jdbc.update("""
                insert into operator_application_review
                    (id, operator_id, reviewed_by, decision, reason, reviewed_at)
                values (?, ?, ?, 'CHANGES_REQUESTED', ?, now())
                """, UUID.randomUUID(), profileId, handler.getId(), "Protected internal review note");

        UUID id = UUID.fromString(submit(operator, "ACCESS", DETAILS, HttpStatus.CREATED).get("id").asText());
        JsonNode detail = act(handler, id, action(DataRightsAction.ASSIGN, 0, handler.getId(), null), HttpStatus.OK);
        detail = act(handler, id, action(DataRightsAction.START_REVIEW, version(detail), null, null), HttpStatus.OK);
        act(handler, id, action(DataRightsAction.RECORD_IDENTITY_VERIFIED, version(detail), null, null),
                HttpStatus.OK);

        String response = mockMvc.perform(get(ADMIN_BASE + "/" + id + "/access-response").with(as(handler)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sections[?(@.category == 'OPERATOR_PROFILE')].records[0].contactPhone")
                        .value("+905551111111"))
                .andExpect(jsonPath("$.sections[?(@.category == 'OPERATOR_APPLICATION_REVIEWS')].records[0].decision")
                        .value("CHANGES_REQUESTED"))
                .andReturn().getResponse().getContentAsString();

        assertThat(response)
                .contains("Own description")
                .doesNotContain("+905552222222")
                .doesNotContain("Other description")
                .doesNotContain("Protected internal review note")
                .doesNotContain(handler.getId().toString());
    }

    @Test
    void rejectionRequiresAReasonAndReleasesTheDuplicateSlot() throws Exception {
        AppUser parent = account(UserRole.PARENT);
        AppUser handler = handler();
        UUID id = UUID.fromString(submit(parent, "OBJECTION", DETAILS, HttpStatus.CREATED).get("id").asText());
        AppUser colleague = handler();
        JsonNode detail = act(handler, id, action(DataRightsAction.ASSIGN, 0, colleague.getId(), null), HttpStatus.OK);
        detail = act(colleague, id, action(DataRightsAction.ASSIGN, version(detail), handler.getId(), null),
                HttpStatus.OK);

        // Responsibility changes are traceable by account id only.
        JsonNode events = detail.get("events");
        assertThat(events.get(0).get("action").asText()).isEqualTo("RECEIVE");
        assertThat(events.get(0).get("newAssigneeId").isNull()).isTrue();
        assertThat(events.get(1).get("previousAssigneeId").isNull()).isTrue();
        assertThat(events.get(1).get("newAssigneeId").asText()).isEqualTo(colleague.getId().toString());
        assertThat(events.get(1).get("actorId").asText()).isEqualTo(handler.getId().toString());
        assertThat(events.get(2).get("previousAssigneeId").asText()).isEqualTo(colleague.getId().toString());
        assertThat(events.get(2).get("newAssigneeId").asText()).isEqualTo(handler.getId().toString());
        assertThat(events.get(2).get("actorId").asText()).isEqualTo(colleague.getId().toString());
        assertThat(events.toString()).doesNotContain("@example.com");

        act(handler, id, action(DataRightsAction.REJECT, version(detail), null, " "), HttpStatus.BAD_REQUEST);
        detail = act(handler, id, action(DataRightsAction.REJECT, version(detail), null, "Kapsam dışı"),
                HttpStatus.OK);
        assertThat(detail.get("status").asText()).isEqualTo("REJECTED");
        JsonNode rejected = detail.get("events").get(3);
        assertThat(rejected.get("previousAssigneeId").isNull()).isTrue();
        assertThat(rejected.get("newAssigneeId").isNull()).isTrue();
        assertThat(jdbc.queryForObject("""
                select count(*) from data_rights_request_event
                where request_id = ? and action = 'ASSIGN' and new_assignee_id is not null
                """, Integer.class, id)).isEqualTo(2);

        submit(parent, "OBJECTION", DETAILS, HttpStatus.CREATED);
    }

    @Test
    void queueTracksOverdueOpenRequestsByDeadline() throws Exception {
        AppUser parent = account(UserRole.PARENT);
        AppUser handler = handler();
        UUID late = UUID.fromString(submit(parent, "ACCESS", DETAILS, HttpStatus.CREATED).get("id").asText());
        UUID fresh = UUID.fromString(submit(parent, "OTHER", DETAILS, HttpStatus.CREATED).get("id").asText());
        jdbc.update("""
                update data_rights_request
                set received_at = received_at - interval '31 days',
                    response_due_at = response_due_at - interval '31 days'
                where id = ?
                """, late);

        JsonNode overdue = read(mockMvc.perform(get(ADMIN_BASE).param("overdue", "true").param("size", "50")
                .with(as(handler))).andExpect(status().isOk())).get("content");
        assertThat(overdue.findValuesAsString("id")).contains(late.toString()).doesNotContain(fresh.toString());
        JsonNode onTime = read(mockMvc.perform(get(ADMIN_BASE).param("overdue", "false").param("size", "50")
                .with(as(handler))).andExpect(status().isOk())).get("content");
        assertThat(onTime.findValuesAsString("id")).contains(fresh.toString()).doesNotContain(late.toString());

        // An outcome without a recorded delivery does not complete the obligation.
        JsonNode detail = act(handler, late, action(DataRightsAction.ASSIGN, 0, handler.getId(), null), HttpStatus.OK);
        detail = act(handler, late, action(DataRightsAction.START_REVIEW, version(detail), null, null), HttpStatus.OK);
        detail = act(handler, late, action(DataRightsAction.RESPOND, version(detail), null, null), HttpStatus.OK);
        assertThat(detail.get("status").asText()).isEqualTo("RESPONDED");
        assertThat(detail.get("overdue").asBoolean()).isTrue();
        assertThat(overdueIds(handler, true)).contains(late.toString());
        assertThat(overdueIds(handler, false)).doesNotContain(late.toString());

        detail = act(handler, late, action(DataRightsAction.RECORD_DELIVERY, version(detail), null, null),
                HttpStatus.OK);
        assertThat(detail.get("overdue").asBoolean()).isFalse();
        assertThat(overdueIds(handler, true)).doesNotContain(late.toString());
        assertThat(overdueIds(handler, false)).contains(late.toString());

        mockMvc.perform(get(ADMIN_BASE).param("size", "51").with(as(handler))).andExpect(status().isBadRequest());
        mockMvc.perform(get(ADMIN_BASE).param("status", "DRAFT").with(as(handler)))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get(ADMIN_BASE + "/" + UUID.randomUUID()).with(as(handler)))
                .andExpect(status().isNotFound());
    }

    @Test
    void concurrentDuplicateSubmissionsCreateExactlyOneRequest() throws Exception {
        AppUser parent = account(UserRole.PARENT);
        SubmitRequest submission = new SubmitRequest(DataRightsRequestType.ACCESS, DETAILS);

        List<Object> outcomes = race(
                () -> service.submit(submission, parent.getId()),
                () -> service.submit(submission, parent.getId())
        );

        assertThat(outcomes).filteredOn(o -> o instanceof DataRightsService.SubmissionResult).hasSize(1);
        assertThat(outcomes).filteredOn(o -> o instanceof DataRightsApiException e
                && e.code().equals("duplicate_open_request")).hasSize(1);
        assertThat(count(parent)).isOne();
    }

    @Test
    void concurrentHandlerActionsOnTheSameVersionApplyOnlyOnce() throws Exception {
        AppUser parent = account(UserRole.PARENT);
        AppUser handler = handler();
        UUID id = service.submit(new SubmitRequest(DataRightsRequestType.ACCESS, DETAILS), parent.getId()).request().id();
        long version = service.act(id, action(DataRightsAction.ASSIGN, 0, handler.getId(), null), handler.getId())
                .version();

        List<Object> outcomes = race(
                () -> service.act(id, action(DataRightsAction.START_REVIEW, version, null, null), handler.getId()),
                () -> service.act(id, action(DataRightsAction.REJECT, version, null, "Kapsam dışı"), handler.getId())
        );

        assertThat(outcomes).filteredOn(o -> o instanceof DataRightsDtos.HandlerDetail).hasSize(1);
        assertThat(outcomes).filteredOn(o -> o instanceof DataRightsApiException e
                && e.code().equals("stale_request_version")).hasSize(1);
        assertThat(jdbc.queryForObject(
                "select count(*) from data_rights_request_event where request_id = ?", Integer.class, id))
                .isEqualTo(3);
    }

    private List<Object> race(Callable<?> first, Callable<?> second) throws Exception {
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            List<Future<?>> futures = List.of(first, second).stream()
                    .<Future<?>>map(task -> executor.submit(() -> {
                        ready.countDown();
                        start.await();
                        return task.call();
                    }))
                    .toList();
            ready.await();
            start.countDown();
            List<Object> outcomes = new ArrayList<>();
            for (Future<?> future : futures) {
                try {
                    outcomes.add(future.get());
                } catch (ExecutionException failure) {
                    outcomes.add(failure.getCause());
                }
            }
            return outcomes;
        }
    }

    private JsonNode submit(AppUser requester, String type, String details, HttpStatus expected) throws Exception {
        return read(mockMvc.perform(post(BASE).with(as(requester)).with(csrf())
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(
                                java.util.Map.of("type", type, "details", details))))
                .andExpect(status().is(expected.value())));
    }

    private JsonNode act(AppUser handler, UUID id, ActionRequest action, HttpStatus expected) throws Exception {
        return read(mockMvc.perform(post(ADMIN_BASE + "/" + id + "/actions").with(as(handler)).with(csrf())
                        .contentType("application/json")
                        .content(json(action)))
                .andExpect(status().is(expected.value())));
    }

    private List<String> overdueIds(AppUser handler, boolean overdue) throws Exception {
        return read(mockMvc.perform(get(ADMIN_BASE).param("overdue", String.valueOf(overdue)).param("size", "50")
                .with(as(handler))).andExpect(status().isOk())).get("content").findValuesAsString("id");
    }

    private static ActionRequest action(DataRightsAction action, long version, UUID assignee, String note) {
        return new ActionRequest(action, version, assignee, note);
    }

    private static long version(JsonNode detail) {
        return detail.get("version").asLong();
    }

    private static JsonNode reference(JsonNode plan, String constraint) {
        for (JsonNode reference : plan.get("references")) {
            if (reference.get("constraint").asText().equals(constraint)) {
                return reference;
            }
        }
        throw new AssertionError("Missing erasure reference " + constraint);
    }

    private JsonNode read(org.springframework.test.web.servlet.ResultActions result) throws Exception {
        return objectMapper.readTree(result.andReturn().getResponse().getContentAsString());
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private int count(AppUser requester) {
        return jdbc.queryForObject(
                "select count(*) from data_rights_request where requester_id = ?", Integer.class, requester.getId());
    }

    private AppUser handler() {
        AppUser admin = account(UserRole.ADMIN);
        jdbc.update("insert into data_rights_handler (user_id, designated_at) values (?, now())", admin.getId());
        return admin;
    }

    private AppUser account(UserRole role) {
        String email = role.name().toLowerCase() + "-" + UUID.randomUUID() + "@example.com";
        AppUser user = role == UserRole.OPERATOR
                ? AppUser.newOperator(email, "hash")
                : AppUser.newParent(email, "hash");
        user.verifyEmail(OffsetDateTime.now());
        user = userRepository.saveAndFlush(user);
        users.add(user.getId());
        if (role == UserRole.ADMIN) {
            jdbc.update("update app_user set role = 'ADMIN' where id = ?", user.getId());
            return userRepository.findById(user.getId()).orElseThrow();
        }
        return user;
    }

    private static RequestPostProcessor as(AppUser account) {
        return user(new AuthenticatedUser(account.getId(), account.getEmail(), "hash", account.getRole(), true));
    }
}
