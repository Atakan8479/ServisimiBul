package com.servisimibul.backend.notification;

import com.servisimibul.backend.demand.Demand;
import com.servisimibul.backend.demand.DemandRepository;
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
import com.servisimibul.backend.notification.NotificationWriteStore.NotificationWrite;
import com.servisimibul.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class NotificationApiTests {

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private AppUserRepository userRepository;
    @Autowired private ProvinceRepository provinceRepository;
    @Autowired private DistrictRepository districtRepository;
    @Autowired private NeighborhoodRepository neighborhoodRepository;
    @Autowired private SchoolRepository schoolRepository;
    @Autowired private DemandRepository demandRepository;
    @Autowired private NotificationWriteStore writeStore;
    @Autowired private InAppNotificationRepository notificationRepository;

    @Test
    void notificationsArePrivateCountedAndReadWithCsrf() throws Exception {
        AppUser recipient = parent("notification-recipient@example.com");
        AppUser other = parent("notification-other@example.com");
        Demand demand = demand(recipient);
        writeStore.insert(notification(recipient.getId(), demand.getId(), "first"));
        writeStore.insert(notification(recipient.getId(), demand.getId(), "first"));
        writeStore.insert(notification(other.getId(), demand.getId(), "other"));

        mockMvc.perform(get("/api/v1/notifications"))
                .andExpect(status().isUnauthorized());

        MvcResult list = mockMvc.perform(get("/api/v1/notifications").with(as(recipient)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].type").value("DEMAND_CREATED"))
                .andExpect(jsonPath("$.content[0].demandId").value(demand.getId().toString()))
                .andExpect(jsonPath("$.content[0].href").value("/demands/" + demand.getId()))
                .andExpect(jsonPath("$.content[0].readAt").doesNotExist())
                .andReturn();
        UUID notificationId = UUID.fromString(objectMapper.readTree(
                list.getResponse().getContentAsByteArray()
        ).path("content").get(0).path("id").asText());

        mockMvc.perform(get("/api/v1/notifications/unread-count").with(as(recipient)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(1));
        mockMvc.perform(put("/api/v1/notifications/{id}/read", notificationId).with(as(recipient)))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/v1/notifications/{id}/read", notificationId)
                        .with(as(other)).with(csrf()))
                .andExpect(status().isNotFound());
        mockMvc.perform(put("/api/v1/notifications/{id}/read", notificationId)
                        .with(as(recipient)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.readAt").isNotEmpty());
        mockMvc.perform(get("/api/v1/notifications/unread-count").with(as(recipient)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(0));

        assertThat(notificationRepository.count()).isEqualTo(2);
    }

    @Test
    void readAllMarksOnlyTheCurrentRecipientAndRequiresCsrf() throws Exception {
        AppUser recipient = parent("read-all-recipient@example.com");
        AppUser other = parent("read-all-other@example.com");
        Demand demand = demand(recipient);
        writeStore.insert(notification(recipient.getId(), demand.getId(), "one"));
        writeStore.insert(notification(recipient.getId(), demand.getId(), "two"));
        writeStore.insert(notification(other.getId(), demand.getId(), "other"));
        jdbcTemplate.update(
                "update in_app_notification set created_at = now() + interval '1 hour' where recipient_user_id = ?",
                recipient.getId()
        );

        mockMvc.perform(put("/api/v1/notifications/read-all").with(csrf()))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(put("/api/v1/notifications/read-all").with(as(recipient)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/notifications/unread-count").with(as(recipient)))
                .andExpect(jsonPath("$.unreadCount").value(2));

        mockMvc.perform(put("/api/v1/notifications/read-all").with(as(recipient)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(0));

        mockMvc.perform(get("/api/v1/notifications").with(as(recipient)))
                .andExpect(jsonPath("$.content[0].readAt").isNotEmpty())
                .andExpect(jsonPath("$.content[1].readAt").isNotEmpty());
        mockMvc.perform(get("/api/v1/notifications/unread-count").with(as(other)))
                .andExpect(jsonPath("$.unreadCount").value(1));

        mockMvc.perform(put("/api/v1/notifications/read-all").with(as(recipient)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(0));
    }

    @Test
    void readStateFiltersBeforePaginationWithinTheRecipient() throws Exception {
        AppUser recipient = parent("filter-recipient@example.com");
        AppUser other = parent("filter-other@example.com");
        Demand demand = demand(recipient);
        for (int index = 0; index < 5; index += 1) {
            writeStore.insert(notification(recipient.getId(), demand.getId(), "n" + index));
        }
        writeStore.insert(notification(other.getId(), demand.getId(), "other"));
        jdbcTemplate.update(
                "update in_app_notification set read_at = created_at where event_key like ?",
                "%" + recipient.getId() + ":n0"
        );
        jdbcTemplate.update(
                "update in_app_notification set read_at = created_at where event_key like ?",
                "%" + recipient.getId() + ":n1"
        );

        mockMvc.perform(get("/api/v1/notifications").param("size", "2").with(as(recipient)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(5))
                .andExpect(jsonPath("$.totalPages").value(3));
        mockMvc.perform(get("/api/v1/notifications").param("readState", "ALL")
                        .param("size", "2").with(as(recipient)))
                .andExpect(jsonPath("$.totalElements").value(5));
        mockMvc.perform(get("/api/v1/notifications").param("readState", "UNREAD")
                        .param("size", "2").with(as(recipient)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].readAt").doesNotExist())
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));
        mockMvc.perform(get("/api/v1/notifications").param("readState", "UNREAD")
                        .param("size", "2").param("page", "1").with(as(recipient)))
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].readAt").doesNotExist())
                .andExpect(jsonPath("$.page").value(1));
        mockMvc.perform(get("/api/v1/notifications").param("readState", "READ")
                        .with(as(recipient)))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].readAt").isNotEmpty())
                .andExpect(jsonPath("$.content[1].readAt").isNotEmpty());
        mockMvc.perform(get("/api/v1/notifications").param("readState", "READ")
                        .with(as(other)))
                .andExpect(jsonPath("$.totalElements").value(0));

        for (String invalid : new String[] {"unread", "SEEN", "ALL,READ"}) {
            mockMvc.perform(get("/api/v1/notifications").param("readState", invalid)
                            .with(as(recipient)))
                    .andExpect(status().isBadRequest());
        }

        mockMvc.perform(put("/api/v1/notifications/read-all").with(as(recipient)).with(csrf()))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/notifications").param("readState", "UNREAD")
                        .with(as(recipient)))
                .andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(get("/api/v1/notifications").param("readState", "READ")
                        .with(as(recipient)))
                .andExpect(jsonPath("$.totalElements").value(5));
        mockMvc.perform(get("/api/v1/notifications").param("readState", "UNREAD")
                        .with(as(other)))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void preferencesAreRoleScopedOwnedAndRequireCsrf() throws Exception {
        AppUser operator = operator("preference-operator@example.com");
        AppUser otherOperator = operator("preference-other@example.com");
        AppUser parent = parent("preference-parent@example.com");
        String disable = "{\"enabled\":false}";

        mockMvc.perform(get("/api/v1/notifications/preferences"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/notifications/preferences").with(as(operator)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].type").value("DEMAND_CREATED"))
                .andExpect(jsonPath("$[0].enabled").value(true));
        mockMvc.perform(get("/api/v1/notifications/preferences").with(as(parent)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        mockMvc.perform(put("/api/v1/notifications/preferences/DEMAND_CREATED")
                        .contentType("application/json").content(disable).with(as(operator)))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/v1/notifications/preferences/DEMAND_CREATED")
                        .contentType("application/json").content(disable).with(csrf()))
                .andExpect(status().isUnauthorized());
        // Essential, unknown, or other-role types can never be disabled.
        for (String type : new String[]{"SERVICE_PUBLISHED", "CONTENT_REPORTED", "FEEDBACK_REMINDER", "NOPE"}) {
            mockMvc.perform(put("/api/v1/notifications/preferences/{type}", type)
                            .contentType("application/json").content(disable)
                            .with(as(operator)).with(csrf()))
                    .andExpect(status().isNotFound());
        }
        mockMvc.perform(put("/api/v1/notifications/preferences/DEMAND_CREATED")
                        .contentType("application/json").content(disable)
                        .with(as(parent)).with(csrf()))
                .andExpect(status().isNotFound());
        mockMvc.perform(put("/api/v1/notifications/preferences/DEMAND_CREATED")
                        .contentType("application/json").content("{}")
                        .with(as(operator)).with(csrf()))
                .andExpect(status().isBadRequest());

        mockMvc.perform(put("/api/v1/notifications/preferences/DEMAND_CREATED")
                        .contentType("application/json").content(disable)
                        .with(as(operator)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false));
        mockMvc.perform(get("/api/v1/notifications/preferences").with(as(operator)))
                .andExpect(jsonPath("$[0].enabled").value(false));
        mockMvc.perform(get("/api/v1/notifications/preferences").with(as(otherOperator)))
                .andExpect(jsonPath("$[0].enabled").value(true));

        mockMvc.perform(put("/api/v1/notifications/preferences/DEMAND_CREATED")
                        .contentType("application/json").content("{\"enabled\":true}")
                        .with(as(operator)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true));
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from notification_preference where user_id = ?",
                Long.class, operator.getId()
        )).isOne();
    }

    private NotificationWrite notification(UUID recipientId, UUID demandId, String suffix) {
        return new NotificationWrite(
                recipientId,
                NotificationType.DEMAND_CREATED,
                "DEMAND_CREATED:" + demandId + ":" + recipientId + ":" + suffix,
                demandId,
                null,
                null,
                null,
                null,
                OffsetDateTime.now()
        );
    }

    private Demand demand(AppUser creator) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Province province = provinceRepository.save(new Province("91", "Province " + suffix));
        District district = districtRepository.save(new District(province, "District " + suffix));
        Neighborhood neighborhood = neighborhoodRepository.saveAndFlush(
                new Neighborhood(district, "Neighborhood " + suffix)
        );
        School school = schoolRepository.saveAndFlush(
                new School(neighborhood, "School " + suffix, null, null, null)
        );
        return demandRepository.saveAndFlush(
                new Demand(school, neighborhood, "2026-2027", creator)
        );
    }

    private AppUser parent(String email) {
        AppUser parent = AppUser.newParent(email, "test-password-hash");
        parent.verifyEmail(OffsetDateTime.now());
        return userRepository.saveAndFlush(parent);
    }

    private AppUser operator(String email) {
        AppUser operator = AppUser.newOperator(email, "test-password-hash");
        operator.verifyEmail(OffsetDateTime.now());
        return userRepository.saveAndFlush(operator);
    }

    private RequestPostProcessor as(AppUser value) {
        return user(new AuthenticatedUser(
                value.getId(), value.getEmail(), "test-password-hash", value.getRole(), true
        ));
    }
}
