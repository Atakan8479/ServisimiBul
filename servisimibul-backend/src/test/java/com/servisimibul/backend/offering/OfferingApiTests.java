package com.servisimibul.backend.offering;

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
import com.servisimibul.backend.security.AuthenticatedUser;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class OfferingApiTests {

    @Autowired
    private MockMvc mockMvc;

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
    private VehicleRepository vehicleRepository;

    @Autowired
    private ServiceOfferingRepository offeringRepository;

    @Autowired
    private ServiceOfferingCoverageRepository offeringCoverageRepository;

    @Autowired
    private OperatorSchoolCoverageRepository generalCoverageRepository;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void operatorCanManageCanonicalVehicleAndDraftOffering() throws Exception {
        Fixture fixture = createFixture("owner@example.com", "Owner", "34 ABC-123");

        mockMvc.perform(post("/api/v1/operator/vehicles")
                        .with(asOperator(fixture.user()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"plate\":\"34 zzz-999\",\"capacity\":8}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.plate").value("34ZZZ999"))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.createdAt").exists());

        mockMvc.perform(get("/api/v1/operator/vehicles").with(asOperator(fixture.user())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].plate").value("34ABC123"))
                .andExpect(jsonPath("$[0].capacity").value(12))
                .andExpect(jsonPath("$[0].active").value(true));

        mockMvc.perform(patch("/api/v1/operator/vehicles/{id}", fixture.vehicle().getId())
                        .with(asOperator(fixture.user()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"plate\":\"34 abc-124\",\"capacity\":14}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plate").value("34ABC124"))
                .andExpect(jsonPath("$.capacity").value(14));

        mockMvc.perform(post("/api/v1/operator/offerings")
                        .with(asOperator(fixture.user()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "operatorSchoolId":"%s",
                                  "vehicleId":"%s",
                                  "availableSeats":7,
                                  "description":"  Morning service  "
                                }
                                """.formatted(
                                fixture.operatorSchool().getId(),
                                fixture.vehicle().getId()
                        )))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.operatorSchoolId")
                        .value(fixture.operatorSchool().getId().toString()))
                .andExpect(jsonPath("$.vehiclePlate").value("34ABC124"))
                .andExpect(jsonPath("$.availableSeats").value(7))
                .andExpect(jsonPath("$.description").value("Morning service"))
                .andExpect(jsonPath("$.published").value(false));

        ServiceOffering offering = offeringRepository.findAll().getFirst();
        mockMvc.perform(patch("/api/v1/operator/offerings/{id}", offering.getId())
                        .with(asOperator(fixture.user()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"availableSeats\":null,\"description\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.availableSeats").doesNotExist())
                .andExpect(jsonPath("$.description").doesNotExist());

        mockMvc.perform(get("/api/v1/operator/offerings/{id}", offering.getId())
                        .with(asOperator(fixture.user())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(offering.getId().toString()));

        mockMvc.perform(post("/api/v1/operator/offerings/{id}/publish", offering.getId())
                        .with(asOperator(fixture.user()))
                        .with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("offering_coverage_required"));

        mockMvc.perform(put("/api/v1/operator/offerings/{id}/coverage", offering.getId())
                        .with(asOperator(fixture.user()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"neighborhoodIds\":[%d]}".formatted(
                                fixture.neighborhood().getId()
                        )))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.coverage.length()").value(1))
                .andExpect(jsonPath("$.coverage[0].neighborhoodId")
                        .value(fixture.neighborhood().getId()));

        mockMvc.perform(post("/api/v1/operator/offerings/{id}/publish", offering.getId())
                        .with(asOperator(fixture.user()))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(true));

        mockMvc.perform(patch("/api/v1/operator/schools/{id}", fixture.operatorSchool().getId())
                        .with(asOperator(fixture.user()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"active\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
        entityManager.clear();
        assertThat(offeringRepository.findById(offering.getId()).orElseThrow().isPublished())
                .isFalse();

        mockMvc.perform(put("/api/v1/operator/offerings/{id}/coverage", offering.getId())
                        .with(asOperator(fixture.user()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"neighborhoodIds\":[]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(false))
                .andExpect(jsonPath("$.coverage").isEmpty());

        mockMvc.perform(post("/api/v1/operator/offerings/{id}/unpublish", offering.getId())
                        .with(asOperator(fixture.user()))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(false));
    }

    @Test
    void plateAndSeatConstraintsAreEnforced() throws Exception {
        Fixture first = createFixture("first@example.com", "First", "34 ABC-123");
        AppUser secondUser = createOperator("second@example.com", "Second");

        mockMvc.perform(post("/api/v1/operator/vehicles")
                        .with(asOperator(secondUser))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"plate\":\" 34-abc 123 \",\"capacity\":9}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("vehicle_plate_conflict"));

        mockMvc.perform(post("/api/v1/operator/offerings")
                        .with(asOperator(first.user()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"operatorSchoolId":"%s","vehicleId":"%s","availableSeats":13}
                                """.formatted(
                                first.operatorSchool().getId(),
                                first.vehicle().getId()
                        )))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.availableSeats")
                        .value("must not exceed vehicle capacity"));

        ServiceOffering offering = offeringRepository.saveAndFlush(new ServiceOffering(
                first.operatorSchool(),
                first.vehicle(),
                8,
                null
        ));
        mockMvc.perform(patch("/api/v1/operator/vehicles/{id}", first.vehicle().getId())
                        .with(asOperator(first.user()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"capacity\":7}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("vehicle_capacity_in_use"));

        assertThat(offeringRepository.findById(offering.getId())).isPresent();
        assertThat(vehicleRepository.findById(first.vehicle().getId()).orElseThrow().getCapacity())
                .isEqualTo(12);
    }

    @Test
    void foreignAndInactiveReferencesAreHiddenOrRejected() throws Exception {
        Fixture owner = createFixture("private@example.com", "Private", "34AAA001");
        Fixture other = createFixture("other@example.com", "Other", "34BBB002");

        mockMvc.perform(post("/api/v1/operator/offerings")
                        .with(asOperator(other.user()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"operatorSchoolId":"%s","vehicleId":"%s"}
                                """.formatted(
                                other.operatorSchool().getId(),
                                owner.vehicle().getId()
                        )))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("vehicle_not_found"));

        mockMvc.perform(post("/api/v1/operator/offerings")
                        .with(asOperator(other.user()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"operatorSchoolId":"%s","vehicleId":"%s"}
                                """.formatted(
                                owner.operatorSchool().getId(),
                                other.vehicle().getId()
                        )))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("operator_school_not_found"));

        owner.vehicle().deactivate();
        vehicleRepository.flush();
        mockMvc.perform(post("/api/v1/operator/offerings")
                        .with(asOperator(owner.user()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"operatorSchoolId":"%s","vehicleId":"%s"}
                                """.formatted(
                                owner.operatorSchool().getId(),
                                owner.vehicle().getId()
                        )))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("vehicle_inactive"));

        mockMvc.perform(get("/api/v1/operator/vehicles/{id}", owner.vehicle().getId())
                        .with(asOperator(other.user())))
                .andExpect(status().isNotFound());

        ServiceOffering offering = offeringRepository.saveAndFlush(new ServiceOffering(
                owner.operatorSchool(),
                owner.vehicle(),
                null,
                null
        ));
        mockMvc.perform(put("/api/v1/operator/offerings/{id}/coverage", offering.getId())
                        .with(asOperator(owner.user()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"neighborhoodIds\":[%d]}".formatted(
                                other.neighborhood().getId()
                        )))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.neighborhoodIds").exists());

        mockMvc.perform(put("/api/v1/operator/offerings/{id}/coverage", offering.getId())
                        .with(asOperator(owner.user()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"neighborhoodIds\":[%d,%d]}".formatted(
                                owner.neighborhood().getId(),
                                owner.neighborhood().getId()
                        )))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("offering_coverage_duplicate"));
        assertThat(offeringCoverageRepository.findAll()).isEmpty();
    }

    @Test
    void generalCoverageReplacementPreservesRetainedLinksAndUnpublishesOnlyWhenEmpty()
            throws Exception {
        Fixture fixture = createFixture("reconcile@example.com", "Reconcile", "34RCN006");
        Province province = fixture.neighborhood().getDistrict().getProvince();
        District secondDistrict = districtRepository.save(new District(province, "Second District"));
        Neighborhood secondNeighborhood = neighborhoodRepository.saveAndFlush(
                new Neighborhood(secondDistrict, "Second Neighborhood")
        );
        OperatorSchoolCoverage retainedCoverage = generalCoverageRepository.saveAndFlush(
                new OperatorSchoolCoverage(fixture.operatorSchool(), secondNeighborhood)
        );
        ServiceOffering offering = offeringRepository.saveAndFlush(new ServiceOffering(
                fixture.operatorSchool(),
                fixture.vehicle(),
                3,
                "Published route"
        ));

        mockMvc.perform(put("/api/v1/operator/offerings/{id}/coverage", offering.getId())
                        .with(asOperator(fixture.user()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"neighborhoodIds\":[%d,%d]}".formatted(
                                fixture.neighborhood().getId(),
                                secondNeighborhood.getId()
                        )))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/operator/offerings/{id}/publish", offering.getId())
                        .with(asOperator(fixture.user()))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(true));

        mockMvc.perform(put("/api/v1/operator/schools/{id}/coverage", fixture.operatorSchool().getId())
                        .with(asOperator(fixture.user()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"neighborhoodIds\":[%d]}".formatted(
                                secondNeighborhood.getId()
                        )))
                .andExpect(status().isOk());

        entityManager.clear();
        assertThat(generalCoverageRepository.findById(retainedCoverage.getId())).isPresent();
        assertThat(offeringRepository.findById(offering.getId()).orElseThrow().isPublished()).isTrue();
        assertThat(offeringCoverageRepository.findAllDetailedByOfferingIds(List.of(offering.getId())))
                .extracting(coverage -> coverage.getOperatorSchoolCoverage().getId())
                .containsExactly(retainedCoverage.getId());

        mockMvc.perform(put("/api/v1/operator/schools/{id}/coverage", fixture.operatorSchool().getId())
                        .with(asOperator(fixture.user()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"neighborhoodIds\":[]}"))
                .andExpect(status().isOk());

        entityManager.clear();
        assertThat(offeringCoverageRepository.findAll()).isEmpty();
        assertThat(offeringRepository.findById(offering.getId()).orElseThrow().isPublished()).isFalse();
    }

    @Test
    void deactivationUnpublishesAndReactivationNeverRepublishes() throws Exception {
        Fixture fixture = createFixture("lifecycle@example.com", "Lifecycle", "34CCC003");
        ServiceOffering offering = offeringRepository.saveAndFlush(new ServiceOffering(
                fixture.operatorSchool(),
                fixture.vehicle(),
                4,
                null
        ));
        jdbcTemplate.update(
                "update service_offering set is_published = true where id = ?",
                offering.getId()
        );
        entityManager.clear();

        mockMvc.perform(post("/api/v1/operator/vehicles/{id}/deactivate", fixture.vehicle().getId())
                        .with(asOperator(fixture.user()))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        entityManager.clear();
        assertThat(offeringRepository.findById(offering.getId()).orElseThrow().isPublished()).isFalse();

        mockMvc.perform(patch("/api/v1/operator/vehicles/{id}", fixture.vehicle().getId())
                        .with(asOperator(fixture.user()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"active\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));

        entityManager.clear();
        assertThat(offeringRepository.findById(offering.getId()).orElseThrow().isPublished()).isFalse();
    }

    @Test
    void deletingOperatorSchoolCascadesItsOfferingsButNotVehicle() throws Exception {
        Fixture fixture = createFixture("cascade@example.com", "Cascade", "34DDD004");
        ServiceOffering offering = offeringRepository.saveAndFlush(new ServiceOffering(
                fixture.operatorSchool(),
                fixture.vehicle(),
                null,
                null
        ));

        mockMvc.perform(delete("/api/v1/operator/schools/{id}", fixture.operatorSchool().getId())
                        .with(asOperator(fixture.user()))
                        .with(csrf()))
                .andExpect(status().isNoContent());

        entityManager.clear();
        assertThat(offeringRepository.findById(offering.getId())).isEmpty();
        assertThat(vehicleRepository.findById(fixture.vehicle().getId())).isPresent();
    }

    @Test
    void emptyStateDoesNotRequireVehiclesOrOfferingsAndMutationsRequireCsrf() throws Exception {
        AppUser operator = createOperator("empty@example.com", "Empty");

        mockMvc.perform(get("/api/v1/operator/vehicles").with(asOperator(operator)))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
        mockMvc.perform(get("/api/v1/operator/offerings").with(asOperator(operator)))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));

        mockMvc.perform(post("/api/v1/operator/vehicles")
                        .with(asOperator(operator))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"plate\":\"34EEE005\",\"capacity\":10}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/operator/vehicles"))
                .andExpect(status().isUnauthorized());
    }

    private Fixture createFixture(String email, String businessName, String plate) {
        AppUser user = createOperator(email, businessName);
        OperatorProfile profile = profileRepository.findByUserId(user.getId()).orElseThrow();
        long suffix = provinceRepository.count() + 1;
        Province province = provinceRepository.save(new Province(
                String.format("%02d", suffix),
                "Province " + suffix
        ));
        District district = districtRepository.save(new District(province, "District " + suffix));
        Neighborhood neighborhood = neighborhoodRepository.saveAndFlush(
                new Neighborhood(district, "Neighborhood " + suffix)
        );
        School school = schoolRepository.saveAndFlush(
                new School(neighborhood, "School " + suffix, null, null, null)
        );
        OperatorSchool operatorSchool = operatorSchoolRepository.saveAndFlush(
                new OperatorSchool(profile, school, true)
        );
        generalCoverageRepository.saveAndFlush(new OperatorSchoolCoverage(
                operatorSchool,
                neighborhood
        ));
        String normalizedPlate = plate.strip().toUpperCase().replace(" ", "").replace("-", "");
        Vehicle vehicle = vehicleRepository.saveAndFlush(new Vehicle(profile, normalizedPlate, 12));
        return new Fixture(user, operatorSchool, vehicle, neighborhood);
    }

    private AppUser createOperator(String email, String businessName) {
        AppUser user = AppUser.newOperator(email, "test-password-hash");
        user.verifyEmail(java.time.OffsetDateTime.now());
        userRepository.saveAndFlush(user);
        OperatorProfile profile = new OperatorProfile(user, businessName, "+905551112233");
        profile.submit();
        profile.approve();
        profileRepository.saveAndFlush(profile);
        return user;
    }

    private RequestPostProcessor asOperator(AppUser user) {
        return user(new AuthenticatedUser(
                user.getId(),
                user.getEmail(),
                "test-password-hash",
                user.getRole(),
                true
        ));
    }

    private record Fixture(
            AppUser user,
            OperatorSchool operatorSchool,
            Vehicle vehicle,
            Neighborhood neighborhood
    ) {
    }
}
