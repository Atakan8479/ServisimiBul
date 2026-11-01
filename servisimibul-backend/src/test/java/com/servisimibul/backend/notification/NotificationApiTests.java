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

    private RequestPostProcessor as(AppUser value) {
        return user(new AuthenticatedUser(
                value.getId(), value.getEmail(), "test-password-hash", value.getRole(), true
        ));
    }
}
