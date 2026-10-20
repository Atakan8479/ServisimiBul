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
import com.servisimibul.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

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
class DemandApiTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private ProvinceRepository provinceRepository;

    @Autowired
    private DistrictRepository districtRepository;

    @Autowired
    private NeighborhoodRepository neighborhoodRepository;

    @Autowired
    private SchoolRepository schoolRepository;

    @Autowired
    private DemandRepository demandRepository;

    @Autowired
    private DemandSupportRepository supportRepository;

    @Test
    void createUsesServerYearAndDuplicateNeverAutoSupportsSecondParent() throws Exception {
        AppUser creator = createParent("demand-creator@example.com");
        AppUser secondParent = createParent("demand-second@example.com");
        GeographyFixture geography = createGeography();

        MvcResult createdResult = mockMvc.perform(post("/api/v1/demands")
                        .with(as(creator))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody(geography.school().getId(), geography.pickup().getId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.created").value(true))
                .andExpect(jsonPath("$.demand.academicYear").value("2026-2027"))
                .andExpect(jsonPath("$.demand.supporterCount").value(1))
                .andExpect(jsonPath("$.demand.morningCount").value(1))
                .andExpect(jsonPath("$.demand.afternoonCount").value(0))
                .andExpect(jsonPath("$.demand.currentUserSupport.status").value("ACTIVE"))
                .andReturn();
        UUID demandId = demandId(createdResult);

        mockMvc.perform(post("/api/v1/demands")
                        .with(as(secondParent))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody(geography.school().getId(), geography.pickup().getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created").value(false))
                .andExpect(jsonPath("$.demand.id").value(demandId.toString()))
                .andExpect(jsonPath("$.demand.supporterCount").value(1))
                .andExpect(jsonPath("$.demand.currentUserSupport").doesNotExist());

        assertThat(demandRepository.count()).isOne();
        assertThat(supportRepository.count()).isOne();

        mockMvc.perform(get("/api/v1/demands")
                        .param("schoolId", geography.school().getId().toString())
                        .param("neighborhoodId", geography.pickup().getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].id").value(demandId.toString()))
                .andExpect(jsonPath("$.content[0].currentUserSupport").doesNotExist())
                .andExpect(jsonPath("$.content[0].reasonCounts.length()").value(6));
    }

    @Test
    void supportIsIdempotentAndWithdrawReactivatesTheSameRow() throws Exception {
        AppUser creator = createParent("support-creator@example.com");
        AppUser supporter = createParent("supporter@example.com");
        GeographyFixture geography = createGeography();
        UUID demandId = createDemand(creator, geography);

        MvcResult joinedResult = mockMvc.perform(post("/api/v1/demands/{id}/support", demandId)
                        .with(as(supporter))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(supportBody(false, true, "NO_AVAILABLE_SEATS")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.supporterCount").value(2))
                .andExpect(jsonPath("$.afternoonCount").value(1))
                .andReturn();
        UUID supportId = UUID.fromString(body(joinedResult)
                .path("currentUserSupport").path("id").asText());

        mockMvc.perform(post("/api/v1/demands/{id}/support", demandId)
                        .with(as(supporter))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(supportBody(true, false, "PRICE_TOO_HIGH")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentUserSupport.id").value(supportId.toString()))
                .andExpect(jsonPath("$.currentUserSupport.needsAfternoon").value(true))
                .andExpect(jsonPath("$.currentUserSupport.reasons[0]").value("NO_AVAILABLE_SEATS"));

        mockMvc.perform(put("/api/v1/demands/{id}/support", demandId)
                        .with(as(supporter))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(supportBody(true, true, "PRICE_TOO_HIGH")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentUserSupport.id").value(supportId.toString()))
                .andExpect(jsonPath("$.currentUserSupport.reasons[0]").value("PRICE_TOO_HIGH"))
                .andExpect(jsonPath("$.morningCount").value(2))
                .andExpect(jsonPath("$.afternoonCount").value(1));

        mockMvc.perform(delete("/api/v1/demands/{id}/support", demandId)
                        .with(as(supporter))
                        .with(csrf()))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/v1/demands/{id}/support", demandId)
                        .with(as(supporter))
                        .with(csrf()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/demands/{id}", demandId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.supporterCount").value(1));

        mockMvc.perform(post("/api/v1/demands/{id}/support", demandId)
                        .with(as(supporter))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(supportBody(false, true, "SCHEDULE_UNSUITABLE")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentUserSupport.id").value(supportId.toString()))
                .andExpect(jsonPath("$.supporterCount").value(2));
        assertThat(supportRepository.count()).isEqualTo(2);

        supporter.disable();
        userRepository.saveAndFlush(supporter);
        mockMvc.perform(get("/api/v1/demands/{id}", demandId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.supporterCount").value(1))
                .andExpect(jsonPath("$.afternoonCount").value(0));
    }

    @Test
    void creationValidatesDirectionsReasonsActiveSchoolAndProvince() throws Exception {
        AppUser parent = createParent("validation-parent@example.com");
        GeographyFixture geography = createGeography();
        Neighborhood foreign = createNeighborhood("06", "Ankara", "Cankaya", "Kizilay");

        mockMvc.perform(post("/api/v1/demands")
                        .with(as(parent))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"schoolId":"%s","neighborhoodId":%d,
                                 "needsMorning":false,"needsAfternoon":false,"reasons":[]}
                                """.formatted(geography.school().getId(), geography.pickup().getId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("validation_error"));

        mockMvc.perform(post("/api/v1/demands")
                        .with(as(parent))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"schoolId":"%s","neighborhoodId":%d,
                                 "needsMorning":true,"needsAfternoon":false,
                                 "reasons":["OTHER","OTHER"]}
                                """.formatted(geography.school().getId(), geography.pickup().getId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.reasons").exists());

        mockMvc.perform(post("/api/v1/demands")
                        .with(as(parent))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody(geography.school().getId(), foreign.getId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.neighborhoodId").exists());

        geography.school().deactivate();
        schoolRepository.saveAndFlush(geography.school());
        mockMvc.perform(post("/api/v1/demands")
                        .with(as(parent))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody(geography.school().getId(), geography.pickup().getId())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("school_inactive"));
    }

    @Test
    void mutationRequiresParentRoleAndCsrfWhileBrowsingIsAnonymous() throws Exception {
        GeographyFixture geography = createGeography();
        AppUser operator = userRepository.saveAndFlush(
                AppUser.newOperator("demand-operator@example.com", "test-password-hash")
        );

        mockMvc.perform(get("/api/v1/demands"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/demands")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody(geography.school().getId(), geography.pickup().getId())))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/demands")
                        .with(as(operator))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody(geography.school().getId(), geography.pickup().getId())))
                .andExpect(status().isForbidden());

        AppUser parent = createParent("csrf-parent@example.com");
        mockMvc.perform(post("/api/v1/demands")
                        .with(as(parent))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody(geography.school().getId(), geography.pickup().getId())))
                .andExpect(status().isForbidden());
    }

    @Test
    void listingFiltersSortsAndPaginatesOnTheServer() throws Exception {
        AppUser firstParent = createParent("listing-first@example.com");
        AppUser secondParent = createParent("listing-second@example.com");
        GeographyFixture first = createGeography();
        Neighborhood secondSchoolNeighborhood = createNeighborhood(
                "35", "Izmir", "Konak", "Alsancak"
        );
        School secondSchool = schoolRepository.saveAndFlush(
                new School(secondSchoolNeighborhood, "Second Demand School", null, null, null)
        );
        UUID firstDemandId = createDemand(firstParent, first);
        UUID secondDemandId = createDemand(
                secondParent,
                new GeographyFixture(secondSchool, secondSchoolNeighborhood)
        );

        mockMvc.perform(post("/api/v1/demands/{id}/support", firstDemandId)
                        .with(as(secondParent))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(supportBody(false, true, "OTHER")))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/demands")
                        .param("sort", "most-supported")
                        .param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.content[0].id").value(firstDemandId.toString()))
                .andExpect(jsonPath("$.content[0].supporterCount").value(2));
        mockMvc.perform(get("/api/v1/demands")
                        .param("schoolId", secondSchool.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].id").value(secondDemandId.toString()));
        mockMvc.perform(get("/api/v1/demands")
                        .param("academicYear", "2026-2028"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.academicYear").exists());
        mockMvc.perform(get("/api/v1/demands").param("size", "51"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.size").exists());
    }

    private UUID createDemand(AppUser parent, GeographyFixture geography) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/demands")
                        .with(as(parent))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody(geography.school().getId(), geography.pickup().getId())))
                .andExpect(status().isCreated())
                .andReturn();
        return demandId(result);
    }

    private UUID demandId(MvcResult result) throws Exception {
        return UUID.fromString(body(result).path("demand").path("id").asText());
    }

    private JsonNode body(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsByteArray());
    }

    private String createBody(UUID schoolId, Long neighborhoodId) {
        return """
                {"schoolId":"%s","neighborhoodId":%d,
                 "needsMorning":true,"needsAfternoon":false,
                 "reasons":["NO_SUITABLE_SERVICE","OTHER"]}
                """.formatted(schoolId, neighborhoodId);
    }

    private String supportBody(boolean morning, boolean afternoon, String reason) {
        return """
                {"needsMorning":%s,"needsAfternoon":%s,"reasons":["%s"]}
                """.formatted(morning, afternoon, reason);
    }

    private AppUser createParent(String email) {
        AppUser parent = AppUser.newParent(email, "test-password-hash");
        parent.verifyEmail(OffsetDateTime.now());
        return userRepository.saveAndFlush(parent);
    }

    private GeographyFixture createGeography() {
        Province province = provinceRepository.save(new Province("34", "Istanbul"));
        District schoolDistrict = districtRepository.save(new District(province, "Kadikoy"));
        District pickupDistrict = districtRepository.save(new District(province, "Uskudar"));
        Neighborhood schoolNeighborhood = neighborhoodRepository.save(
                new Neighborhood(schoolDistrict, "Caferaga")
        );
        Neighborhood pickup = neighborhoodRepository.saveAndFlush(
                new Neighborhood(pickupDistrict, "Acibadem")
        );
        School school = schoolRepository.saveAndFlush(
                new School(schoolNeighborhood, "Demand School", null, null, null)
        );
        return new GeographyFixture(school, pickup);
    }

    private Neighborhood createNeighborhood(
            String provinceCode,
            String provinceName,
            String districtName,
            String neighborhoodName
    ) {
        Province province = provinceRepository.save(new Province(provinceCode, provinceName));
        District district = districtRepository.save(new District(province, districtName));
        return neighborhoodRepository.saveAndFlush(new Neighborhood(district, neighborhoodName));
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

    private record GeographyFixture(School school, Neighborhood pickup) {
    }
}
