package com.servisimibul.backend.demand;

import com.servisimibul.backend.geography.District;
import com.servisimibul.backend.geography.DistrictRepository;
import com.servisimibul.backend.geography.Neighborhood;
import com.servisimibul.backend.geography.NeighborhoodRepository;
import com.servisimibul.backend.geography.Province;
import com.servisimibul.backend.geography.ProvinceRepository;
import com.servisimibul.backend.geography.School;
import com.servisimibul.backend.geography.SchoolRepository;
import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import com.servisimibul.backend.identity.OperatorProfile;
import com.servisimibul.backend.identity.OperatorProfileRepository;
import com.servisimibul.backend.operatorschool.OperatorSchool;
import com.servisimibul.backend.operatorschool.OperatorSchoolCoverage;
import com.servisimibul.backend.operatorschool.OperatorSchoolCoverageRepository;
import com.servisimibul.backend.operatorschool.OperatorSchoolRepository;
import com.servisimibul.backend.notification.InAppNotificationRepository;
import com.servisimibul.backend.notification.NotificationType;
import com.servisimibul.backend.security.AuthenticatedUser;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.OffsetDateTime;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class DemandServiceResponseApiTests {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private EntityManager entityManager;
    @Autowired
    private AppUserRepository userRepository;
    @Autowired
    private OperatorProfileRepository profileRepository;
    @Autowired
    private ProvinceRepository provinceRepository;
    @Autowired
    private DistrictRepository districtRepository;
    @Autowired
    private NeighborhoodRepository neighborhoodRepository;
    @Autowired
    private SchoolRepository schoolRepository;
    @Autowired
    private OperatorSchoolRepository operatorSchoolRepository;
    @Autowired
    private OperatorSchoolCoverageRepository coverageRepository;
    @Autowired
    private DemandRepository demandRepository;
    @Autowired
    private DemandServiceResponseRepository responseRepository;
    @Autowired
    private DemandServicePublicationEventRepository eventRepository;
    @Autowired
    private DemandSupportRepository supportRepository;
    @Autowired
    private DemandServiceFeedbackRepository feedbackRepository;
    @Autowired
    private DemandLifecycleEventRepository lifecycleEventRepository;
    @Autowired
    private com.servisimibul.backend.demand.service.DemandFeedbackService feedbackService;
    @Autowired
    private InAppNotificationRepository notificationRepository;

    @Test
    void eligibleOperatorPublishesImmediatelyAndLifecycleIsIdempotent() throws Exception {
        Fixture fixture = fixture("response-owner@example.com", true);

        MvcResult first = mockMvc.perform(post(operatorPath(fixture.demand()))
                        .with(as(fixture.operatorUser()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(directionBody(true, false)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(true))
                .andExpect(jsonPath("$.response.status").value("ACTIVE"))
                .andExpect(jsonPath("$.response.publicationVersion").value(1))
                .andExpect(jsonPath("$.response.currentlyPublic").value(true))
                .andReturn();
        JsonNode firstResponse = body(first).path("response");
        UUID responseId = UUID.fromString(firstResponse.path("id").asText());
        UUID firstEventId = UUID.fromString(firstResponse.path("publicationEventId").asText());
        UUID supportId = supportRepository.findOwned(
                fixture.demand().getId(),
                fixture.parent().getId()
        ).orElseThrow().getId();
        DemandServiceFeedback firstFeedback = feedbackRepository
                .findDetailedBySupportId(supportId).getFirst();
        assertThat(notificationRepository.countByRecipientUserIdAndType(
                fixture.parent().getId(), NotificationType.SERVICE_PUBLISHED
        )).isOne();

        mockMvc.perform(get(publicPath(fixture.demand())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(responseId.toString()))
                .andExpect(jsonPath("$.content[0].publicationEventId").value(firstEventId.toString()))
                .andExpect(jsonPath("$.content[0].businessName").value("Response Operator"))
                .andExpect(jsonPath("$.content[0].contactPhone").value("+905551112233"))
                .andExpect(jsonPath("$.content[0].offersMorning").value(true))
                .andExpect(jsonPath("$.content[0].offersAfternoon").value(false));

        mockMvc.perform(post(operatorPath(fixture.demand()))
                        .with(as(fixture.operatorUser()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(directionBody(false, true)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(false))
                .andExpect(jsonPath("$.response.id").value(responseId.toString()))
                .andExpect(jsonPath("$.response.publicationEventId").value(firstEventId.toString()))
                .andExpect(jsonPath("$.response.offersMorning").value(true))
                .andExpect(jsonPath("$.response.offersAfternoon").value(false));
        assertThat(responseRepository.count()).isOne();
        assertThat(eventRepository.countByResponseId(responseId)).isOne();
        assertThat(notificationRepository.countByRecipientUserIdAndType(
                fixture.parent().getId(), NotificationType.SERVICE_PUBLISHED
        )).isOne();

        mockMvc.perform(delete(operatorPath(fixture.demand()))
                        .with(as(fixture.operatorUser()))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WITHDRAWN"))
                .andExpect(jsonPath("$.currentlyPublic").value(false));
        mockMvc.perform(delete(operatorPath(fixture.demand()))
                        .with(as(fixture.operatorUser()))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WITHDRAWN"));
        mockMvc.perform(get(publicPath(fixture.demand())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
        assertThat(feedbackRepository.findById(firstFeedback.getId()).orElseThrow().getStatus())
                .isEqualTo(DemandServiceFeedbackStatus.SUPERSEDED);
        assertThat(notificationRepository.countByRecipientUserIdAndType(
                fixture.parent().getId(), NotificationType.SERVICE_WITHDRAWN
        )).isOne();

        MvcResult republished = mockMvc.perform(post(operatorPath(fixture.demand()))
                        .with(as(fixture.operatorUser()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(directionBody(false, true)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(true))
                .andExpect(jsonPath("$.response.id").value(responseId.toString()))
                .andExpect(jsonPath("$.response.publicationVersion").value(2))
                .andExpect(jsonPath("$.response.offersMorning").value(false))
                .andExpect(jsonPath("$.response.offersAfternoon").value(true))
                .andReturn();
        UUID secondEventId = UUID.fromString(
                body(republished).path("response").path("publicationEventId").asText()
        );
        assertThat(secondEventId).isNotEqualTo(firstEventId);
        assertThat(eventRepository.countByResponseId(responseId)).isEqualTo(2);
        List<DemandServiceFeedback> allFeedback = feedbackRepository.findDetailedBySupportId(supportId);
        assertThat(allFeedback).hasSize(2);
        assertThat(allFeedback).extracting(DemandServiceFeedback::getStatus)
                .containsExactlyInAnyOrder(
                        DemandServiceFeedbackStatus.SUPERSEDED,
                        DemandServiceFeedbackStatus.AWAITING_FEEDBACK
                );
        assertThat(notificationRepository.countByRecipientUserIdAndType(
                fixture.parent().getId(), NotificationType.SERVICE_PUBLISHED
        )).isEqualTo(2);
        feedbackService.processDue(firstFeedback.getId());
        assertThat(supportRepository.findOwned(
                fixture.demand().getId(),
                fixture.parent().getId()
        ).orElseThrow().getStatus()).isEqualTo(DemandSupportStatus.AWAITING_FEEDBACK);
    }

    @Test
    void currentEligibilityInvalidatesPublicDisplayWithoutChangingResponseHistory() throws Exception {
        Fixture fixture = fixture("response-invalidation@example.com", true);
        publish(fixture);

        fixture.profile().update(
                fixture.profile().getBusinessName(),
                fixture.profile().getContactPhone(),
                fixture.profile().getDescription(),
                false
        );
        profileRepository.flush();
        mockMvc.perform(get(publicPath(fixture.demand())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(get(operatorPath(fixture.demand()))
                        .with(as(fixture.operatorUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eligible").value(false))
                .andExpect(jsonPath("$.blockers[0]").value("PROFILE_HIDDEN"))
                .andExpect(jsonPath("$.response.currentlyPublic").value(false));

        fixture.profile().update(
                fixture.profile().getBusinessName(),
                fixture.profile().getContactPhone(),
                fixture.profile().getDescription(),
                true
        );
        coverageRepository.deleteAllByOperatorSchoolId(fixture.operatorSchool().getId());
        coverageRepository.flush();
        mockMvc.perform(get(publicPath(fixture.demand())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(get(operatorPath(fixture.demand()))
                        .with(as(fixture.operatorUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blockers[0]").value("COVERAGE_MISSING"));

        coverageRepository.saveAndFlush(new OperatorSchoolCoverage(
                fixture.operatorSchool(),
                fixture.pickup()
        ));
        mockMvc.perform(get(publicPath(fixture.demand())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
        assertThat(responseRepository.count()).isOne();
        assertThat(eventRepository.count()).isOne();
    }

    @Test
    void missingCoverageClosedDemandAndCrossOwnerMutationFailClosed() throws Exception {
        Fixture owner = fixture("response-scope-owner@example.com", false);
        Fixture other = operatorForExistingDemand(
                "response-scope-other@example.com",
                owner,
                true
        );

        mockMvc.perform(post(operatorPath(owner.demand()))
                        .with(as(owner.operatorUser()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(directionBody(true, false)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("operator_coverage_required"));

        publish(other);
        mockMvc.perform(delete(operatorPath(owner.demand()))
                        .with(as(owner.operatorUser()))
                        .with(csrf()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("demand_service_response_not_found"));
        mockMvc.perform(get(publicPath(owner.demand())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));

        jdbcTemplate.update("""
                update demand
                set status = 'CLOSED', closure_reason = 'ADMIN', closed_at = now()
                where id = ?
                """, owner.demand().getId());
        entityManager.clear();
        mockMvc.perform(get(publicPath(owner.demand())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(post(operatorPath(owner.demand()))
                        .with(as(other.operatorUser()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(directionBody(true, true)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("demand_not_open"));
    }

    @Test
    void operatorMutationRequiresRoleAndCsrfAndDirections() throws Exception {
        Fixture fixture = fixture("response-security@example.com", true);
        AppUser parent = verifiedParent("response-parent-role@example.com");

        mockMvc.perform(post(operatorPath(fixture.demand()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(directionBody(true, false)))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post(operatorPath(fixture.demand()))
                        .with(as(parent))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(directionBody(true, false)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(operatorPath(fixture.demand()))
                        .with(as(fixture.operatorUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(directionBody(true, false)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(operatorPath(fixture.demand()))
                        .with(as(fixture.operatorUser()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(directionBody(false, false)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.offersMorning").exists());

        MvcResult result = mockMvc.perform(get(publicPath(fixture.demand())))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(result.getRequest().getSession(false)).isNull();
    }

    @Test
    void safeDefaultRequiresApprovedOperator() throws Exception {
        Fixture draft = fixture("response-draft@example.com", true, false);

        mockMvc.perform(get(operatorPath(draft.demand()))
                        .with(as(draft.operatorUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eligible").value(false))
                .andExpect(jsonPath("$.blockers[0]").value("APPROVAL_REQUIRED"));
        mockMvc.perform(post(operatorPath(draft.demand()))
                        .with(as(draft.operatorUser()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(directionBody(true, false)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("operator_approval_required"));
    }

    @Test
    void publicationCreatesFeedbackWithoutClosingDemandAndParentCanRejectIt() throws Exception {
        Fixture fixture = fixture("feedback-reject@example.com", true);

        publish(fixture);
        DemandSupport support = supportRepository.findOwned(
                fixture.demand().getId(),
                fixture.parent().getId()
        ).orElseThrow();
        List<DemandServiceFeedback> feedback = feedbackRepository.findDetailedBySupportId(
                support.getId()
        );
        assertThat(feedback).hasSize(1);
        DemandServiceFeedback opportunity = feedback.getFirst();
        assertThat(support.getStatus()).isEqualTo(DemandSupportStatus.AWAITING_FEEDBACK);
        assertThat(fixture.demand().isOpen()).isTrue();
        assertThat(Duration.between(
                opportunity.getPublicationEvent().getPublishedAt(),
                opportunity.getExpiresAt()
        )).isEqualTo(Duration.ofDays(45));

        MvcResult opened = mockMvc.perform(post(feedbackPath(fixture.demand()) + "/open")
                        .with(as(fixture.parent()))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.feedback[0].status").value("AWAITING_FEEDBACK"))
                .andExpect(jsonPath("$.feedback[0].openedAt").exists())
                .andReturn();
        JsonNode openedFeedback = body(opened).path("feedback").get(0);
        OffsetDateTime openedAt = OffsetDateTime.parse(openedFeedback.path("openedAt").asText());
        assertThat(Duration.between(
                openedAt,
                OffsetDateTime.parse(openedFeedback.path("reminderDueAt").asText())
        )).isEqualTo(Duration.ofDays(7));
        assertThat(Duration.between(
                openedAt,
                OffsetDateTime.parse(openedFeedback.path("expiresAt").asText())
        )).isEqualTo(Duration.ofDays(14));

        mockMvc.perform(put(feedbackPath(fixture.demand()) + "/" + opportunity.getPublicationEvent().getId())
                        .with(as(fixture.parent()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"satisfied\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.feedback[0].status").value("NOT_SATISFIED"));
        entityManager.flush();
        entityManager.clear();
        assertThat(supportRepository.findOwned(
                fixture.demand().getId(),
                fixture.parent().getId()
        ).orElseThrow().getStatus()).isEqualTo(DemandSupportStatus.ACTIVE);
        assertThat(demandRepository.findById(fixture.demand().getId()).orElseThrow().isOpen()).isTrue();
    }

    @Test
    void explicitSatisfactionClosesFulfilledAndFeedbackEndpointsAreProtected() throws Exception {
        Fixture fixture = fixture("feedback-satisfied@example.com", true);
        publish(fixture);
        DemandServiceFeedback feedback = feedbackRepository.findDetailedBySupportId(
                supportRepository.findOwned(fixture.demand().getId(), fixture.parent().getId())
                        .orElseThrow().getId()
        ).getFirst();

        mockMvc.perform(get(feedbackPath(fixture.demand())))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get(feedbackPath(fixture.demand())).with(as(fixture.operatorUser())))
                .andExpect(status().isForbidden());
        mockMvc.perform(put(feedbackPath(fixture.demand()) + "/" + feedback.getPublicationEvent().getId())
                        .with(as(fixture.parent()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"satisfied\":true}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(put(feedbackPath(fixture.demand()) + "/" + feedback.getPublicationEvent().getId())
                        .with(as(fixture.parent()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"satisfied\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.feedback[0].status").value("SATISFIED"));
        entityManager.flush();
        entityManager.clear();
        Demand closed = demandRepository.findById(fixture.demand().getId()).orElseThrow();
        assertThat(closed.getStatus()).isEqualTo(DemandStatus.CLOSED);
        assertThat(closed.getClosureReason()).isEqualTo(DemandClosureReason.FULFILLED);
        assertThat(lifecycleEventRepository.countByDemandIdAndEventType(
                closed.getId(),
                DemandLifecycleEventType.CLOSED_FULFILLED
        )).isOne();
    }

    @Test
    void expiredSupportDoesNotVetoFulfillmentConfirmedByRemainingParents() throws Exception {
        Fixture fixture = fixture("feedback-mixed@example.com", true);
        AppUser second = verifiedParent("feedback-second@example.com");
        AppUser third = verifiedParent("feedback-third@example.com");
        supportRepository.saveAndFlush(new DemandSupport(
                fixture.demand(), second, true, false,
                java.util.Set.of(SupportReason.NO_SUITABLE_SERVICE)
        ));
        supportRepository.saveAndFlush(new DemandSupport(
                fixture.demand(), third, true, false,
                java.util.Set.of(SupportReason.NO_SUITABLE_SERVICE)
        ));
        publish(fixture);

        for (AppUser parent : List.of(fixture.parent(), second)) {
            DemandSupport support = supportRepository.findOwned(
                    fixture.demand().getId(), parent.getId()
            ).orElseThrow();
            UUID eventId = feedbackRepository.findDetailedBySupportId(support.getId())
                    .getFirst().getPublicationEvent().getId();
            mockMvc.perform(put(feedbackPath(fixture.demand()) + "/" + eventId)
                            .with(as(parent))
                            .with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"satisfied\":true}"))
                    .andExpect(status().isOk());
            assertThat(demandRepository.findById(fixture.demand().getId()).orElseThrow().isOpen())
                    .isTrue();
        }

        DemandSupport unanswered = supportRepository.findOwned(
                fixture.demand().getId(), third.getId()
        ).orElseThrow();
        DemandServiceFeedback feedback = feedbackRepository.findDetailedBySupportId(
                unanswered.getId()
        ).getFirst();
        jdbcTemplate.update("""
                update demand_service_feedback
                set expires_at = now() - interval '1 minute'
                where id = ?
                """, feedback.getId());
        entityManager.clear();
        feedbackService.processDue(feedback.getId());
        entityManager.flush();
        entityManager.clear();

        assertThat(supportRepository.findOwned(fixture.demand().getId(), third.getId())
                .orElseThrow().getStatus()).isEqualTo(DemandSupportStatus.INACTIVE_EXPIRED);
        Demand closed = demandRepository.findById(fixture.demand().getId()).orElseThrow();
        assertThat(closed.getClosureReason()).isEqualTo(DemandClosureReason.FULFILLED);
        assertThat(lifecycleEventRepository.countByDemandIdAndEventType(
                closed.getId(), DemandLifecycleEventType.CLOSED_FULFILLED
        )).isOne();
    }

    @Test
    void reminderAndExpiryAreIdempotentAndInactiveDemandCanBeReopened() throws Exception {
        Fixture fixture = fixture("feedback-expiry@example.com", true);
        publish(fixture);
        DemandSupport support = supportRepository.findOwned(
                fixture.demand().getId(),
                fixture.parent().getId()
        ).orElseThrow();
        DemandServiceFeedback feedback = feedbackRepository.findDetailedBySupportId(support.getId()).getFirst();

        jdbcTemplate.update("""
                update demand_service_feedback
                set opened_at = now() - interval '8 days',
                    reminder_due_at = now() - interval '1 day',
                    expires_at = now() + interval '6 days'
                where id = ?
                """, feedback.getId());
        entityManager.clear();
        feedbackService.processDue(feedback.getId());
        entityManager.flush();
        entityManager.clear();
        assertThat(feedbackRepository.findById(feedback.getId()).orElseThrow().getReminderTriggeredAt())
                .isNotNull();
        assertThat(notificationRepository.countByRecipientUserIdAndType(
                fixture.parent().getId(), NotificationType.FEEDBACK_REMINDER
        )).isOne();

        jdbcTemplate.update("""
                update demand_service_feedback set expires_at = now() - interval '1 minute' where id = ?
                """, feedback.getId());
        entityManager.clear();
        feedbackService.processDue(feedback.getId());
        feedbackService.processDue(feedback.getId());
        entityManager.flush();
        entityManager.clear();
        assertThat(feedbackRepository.findById(feedback.getId()).orElseThrow().getStatus())
                .isEqualTo(DemandServiceFeedbackStatus.INACTIVE_EXPIRED);
        assertThat(notificationRepository.countByRecipientUserIdAndType(
                fixture.parent().getId(), NotificationType.SUPPORT_EXPIRED
        )).isOne();
        Demand inactive = demandRepository.findById(fixture.demand().getId()).orElseThrow();
        assertThat(inactive.getClosureReason()).isEqualTo(DemandClosureReason.INACTIVE);
        assertThat(lifecycleEventRepository.countByDemandIdAndEventType(
                inactive.getId(),
                DemandLifecycleEventType.CLOSED_INACTIVE
        )).isOne();

        mockMvc.perform(post("/api/v1/demands/" + inactive.getId() + "/support")
                        .with(as(fixture.parent()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"needsMorning":true,"needsAfternoon":false,"reasons":["NO_SUITABLE_SERVICE"]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andExpect(jsonPath("$.currentUserSupport.status").value("ACTIVE"));
        assertThat(lifecycleEventRepository.countByDemandIdAndEventType(
                inactive.getId(),
                DemandLifecycleEventType.REOPENED
        )).isOne();

        Fixture unseenFixture = fixture("feedback-unseen-expiry@example.com", true);
        publish(unseenFixture);
        DemandServiceFeedback unseen = feedbackRepository.findDetailedBySupportId(
                supportRepository.findOwned(
                        unseenFixture.demand().getId(),
                        unseenFixture.parent().getId()
                ).orElseThrow().getId()
        ).getFirst();
        assertThat(unseen.getOpenedAt()).isNull();
        jdbcTemplate.update("""
                update demand_service_feedback set expires_at = now() - interval '1 minute' where id = ?
                """, unseen.getId());
        entityManager.clear();
        feedbackService.processDue(unseen.getId());
        entityManager.flush();
        entityManager.clear();
        assertThat(feedbackRepository.findById(unseen.getId()).orElseThrow().getStatus())
                .isEqualTo(DemandServiceFeedbackStatus.INACTIVE_EXPIRED);
        assertThat(demandRepository.findById(unseenFixture.demand().getId()).orElseThrow()
                .getClosureReason()).isEqualTo(DemandClosureReason.INACTIVE);
    }

    private void publish(Fixture fixture) throws Exception {
        mockMvc.perform(post(operatorPath(fixture.demand()))
                        .with(as(fixture.operatorUser()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(directionBody(true, false)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(true));
    }

    private Fixture fixture(String email, boolean withCoverage) {
        return fixture(email, withCoverage, true);
    }

    private Fixture fixture(String email, boolean withCoverage, boolean approved) {
        Province province = provinceRepository.save(new Province(
                uniqueCode(),
                "Istanbul " + UUID.randomUUID().toString().substring(0, 8)
        ));
        District schoolDistrict = districtRepository.save(new District(province, "Kadikoy"));
        District pickupDistrict = districtRepository.save(new District(province, "Uskudar"));
        Neighborhood schoolNeighborhood = neighborhoodRepository.save(
                new Neighborhood(schoolDistrict, "Caferaga")
        );
        Neighborhood pickup = neighborhoodRepository.saveAndFlush(
                new Neighborhood(pickupDistrict, "Acibadem")
        );
        School school = schoolRepository.saveAndFlush(
                new School(schoolNeighborhood, "Response School", null, null, null)
        );
        AppUser parent = verifiedParent("creator-" + email);
        Demand demand = demandRepository.saveAndFlush(new Demand(
                school,
                pickup,
                "2026-2027",
                parent
        ));
        supportRepository.saveAndFlush(new DemandSupport(
                demand,
                parent,
                true,
                true,
                java.util.Set.of(SupportReason.NO_SUITABLE_SERVICE)
        ));
        OperatorFixture operator = createOperator(email, school, pickup, withCoverage, approved);
        return new Fixture(
                demand,
                pickup,
                parent,
                operator.user(),
                operator.profile(),
                operator.operatorSchool()
        );
    }

    private Fixture operatorForExistingDemand(
            String email,
            Fixture existing,
            boolean withCoverage
    ) {
        OperatorFixture operator = createOperator(
                email,
                existing.demand().getSchool(),
                existing.pickup(),
                withCoverage,
                true
        );
        return new Fixture(
                existing.demand(),
                existing.pickup(),
                existing.parent(),
                operator.user(),
                operator.profile(),
                operator.operatorSchool()
        );
    }

    private OperatorFixture createOperator(
            String email,
            School school,
            Neighborhood pickup,
            boolean withCoverage,
            boolean approved
    ) {
        AppUser user = AppUser.newOperator(email, "test-password-hash");
        user.verifyEmail(OffsetDateTime.now());
        userRepository.saveAndFlush(user);
        OperatorProfile profile = new OperatorProfile(
                user,
                "Response Operator",
                "+905551112233"
        );
        if (approved) {
            profile.submit();
            profile.approve();
        }
        profileRepository.saveAndFlush(profile);
        OperatorSchool operatorSchool = operatorSchoolRepository.saveAndFlush(
                new OperatorSchool(profile, school, true)
        );
        if (withCoverage) {
            coverageRepository.saveAndFlush(new OperatorSchoolCoverage(operatorSchool, pickup));
        }
        return new OperatorFixture(user, profile, operatorSchool);
    }

    private AppUser verifiedParent(String email) {
        AppUser parent = AppUser.newParent(email, "test-password-hash");
        parent.verifyEmail(OffsetDateTime.now());
        return userRepository.saveAndFlush(parent);
    }

    private JsonNode body(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsByteArray());
    }

    private String operatorPath(Demand demand) {
        return "/api/v1/operator/demands/%s/response".formatted(demand.getId());
    }

    private String publicPath(Demand demand) {
        return "/api/v1/demands/%s/responses".formatted(demand.getId());
    }

    private String feedbackPath(Demand demand) {
        return "/api/v1/demands/%s/feedback".formatted(demand.getId());
    }

    private String directionBody(boolean morning, boolean afternoon) {
        return """
                {"offersMorning":%s,"offersAfternoon":%s}
                """.formatted(morning, afternoon);
    }

    private RequestPostProcessor as(AppUser user) {
        return user(new AuthenticatedUser(
                user.getId(),
                user.getEmail(),
                "test-password-hash",
                user.getRole(),
                true
        ));
    }

    private String uniqueCode() {
        return UUID.randomUUID().toString().substring(0, 2);
    }

    private record OperatorFixture(
            AppUser user,
            OperatorProfile profile,
            OperatorSchool operatorSchool
    ) {
    }

    private record Fixture(
            Demand demand,
            Neighborhood pickup,
            AppUser parent,
            AppUser operatorUser,
            OperatorProfile profile,
            OperatorSchool operatorSchool
    ) {
    }
}
