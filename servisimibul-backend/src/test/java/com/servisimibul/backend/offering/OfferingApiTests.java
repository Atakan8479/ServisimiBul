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
import com.jayway.jsonpath.JsonPath;
import com.servisimibul.backend.security.AuthenticatedUser;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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

    @Test
    void ownerCanPermanentlyDeleteUnreferencedVehicleOnce() throws Exception {
        Fixture fixture = createFixture("delete-free@example.com", "Delete Free", "34FFF006");
        fixture.vehicle().deactivate();
        vehicleRepository.saveAndFlush(fixture.vehicle());

        mockMvc.perform(get("/api/v1/operator/vehicles").with(asOperator(fixture.user())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].deletable").value(true))
                .andExpect(jsonPath("$[0].deletionBlockedReason").isEmpty());

        mockMvc.perform(delete("/api/v1/operator/vehicles/{id}", fixture.vehicle().getId())
                        .with(asOperator(fixture.user()))
                        .with(csrf()))
                .andExpect(status().isNoContent());

        entityManager.clear();
        assertThat(vehicleRepository.findById(fixture.vehicle().getId())).isEmpty();

        mockMvc.perform(delete("/api/v1/operator/vehicles/{id}", fixture.vehicle().getId())
                        .with(asOperator(fixture.user()))
                        .with(csrf()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("vehicle_not_found"));
    }

    @Test
    void vehicleReferencedByAnyOfferingCannotBeDeleted() throws Exception {
        Fixture fixture = createFixture("delete-used@example.com", "Delete Used", "34GGG007");
        ServiceOffering draft = offeringRepository.saveAndFlush(new ServiceOffering(
                fixture.operatorSchool(),
                fixture.vehicle(),
                null,
                null
        ));
        entityManager.clear();

        mockMvc.perform(get("/api/v1/operator/vehicles/{id}", fixture.vehicle().getId())
                        .with(asOperator(fixture.user())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deletable").value(false))
                .andExpect(jsonPath("$.deletionBlockedReason").value("IN_USE"));

        mockMvc.perform(delete("/api/v1/operator/vehicles/{id}", fixture.vehicle().getId())
                        .with(asOperator(fixture.user()))
                        .with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("vehicle_in_use"));

        entityManager.clear();
        assertThat(vehicleRepository.findById(fixture.vehicle().getId())).isPresent();
        assertThat(offeringRepository.findById(draft.getId())).isPresent();
    }

    @Test
    void reassignedOfferingLeavesPreviousVehiclePermanentlyUndeletable() throws Exception {
        Fixture fixture = createFixture("delete-moved@example.com", "Delete Moved", "34KKK010");
        OperatorProfile profile = profileRepository.findByUserId(fixture.user().getId()).orElseThrow();
        Vehicle replacement = vehicleRepository.saveAndFlush(new Vehicle(profile, "34KKK011", 12));
        String created = mockMvc.perform(post("/api/v1/operator/offerings")
                        .with(asOperator(fixture.user()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"operatorSchoolId\":\"" + fixture.operatorSchool().getId()
                                + "\",\"vehicleId\":\"" + fixture.vehicle().getId() + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String offeringId = JsonPath.read(created, "$.id");

        mockMvc.perform(patch("/api/v1/operator/offerings/{id}", offeringId)
                        .with(asOperator(fixture.user()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"vehicleId\":\"" + replacement.getId() + "\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/operator/vehicles").with(asOperator(fixture.user())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].plate").value("34KKK010"))
                .andExpect(jsonPath("$[0].deletable").value(false))
                .andExpect(jsonPath("$[0].deletionBlockedReason").value("PREVIOUSLY_USED"))
                .andExpect(jsonPath("$[1].deletionBlockedReason").value("IN_USE"));
        expectDeleteConflict(fixture, fixture.vehicle(), "vehicle_previously_used");
    }

    @Test
    void deletingSchoolRelationshipDoesNotEraseVehicleUsage() throws Exception {
        Fixture fixture = createFixture("delete-school@example.com", "Delete School", "34LLL012");
        offeringRepository.saveAndFlush(new ServiceOffering(
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
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from service_offering where vehicle_id = ?",
                Integer.class,
                fixture.vehicle().getId()
        )).isZero();

        expectDeleteConflict(fixture, fixture.vehicle(), "vehicle_previously_used");
    }

    @Test
    void vehicleWithUnknownHistoryCannotBeDeleted() throws Exception {
        Fixture fixture = createFixture("delete-unknown@example.com", "Delete Unknown", "34MMM013");
        // Simulates a pre-V22 vehicle; downgrading to unknown history is allowed, upgrading is not.
        jdbcTemplate.update(
                "update vehicle set usage_history_complete = false where id = ?",
                fixture.vehicle().getId()
        );

        mockMvc.perform(get("/api/v1/operator/vehicles/{id}", fixture.vehicle().getId())
                        .with(asOperator(fixture.user())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deletable").value(false))
                .andExpect(jsonPath("$.deletionBlockedReason").value("HISTORY_UNKNOWN"));
        expectDeleteConflict(fixture, fixture.vehicle(), "vehicle_history_unknown");
    }

    @Test
    void directSqlCannotResetUsageHistoryOrBypassDeletionGuard() {
        Fixture fixture = createFixture("delete-sql@example.com", "Delete Sql", "34NNN014");
        UUID vehicleId = fixture.vehicle().getId();
        jdbcTemplate.update(
                "insert into service_offering (id, operator_school_id, vehicle_id) values (gen_random_uuid(), ?, ?)",
                fixture.operatorSchool().getId(),
                vehicleId
        );
        jdbcTemplate.update("delete from service_offering where vehicle_id = ?", vehicleId);
        assertThat(jdbcTemplate.queryForObject(
                "select usage_recorded_at is not null from vehicle where id = ?",
                Boolean.class,
                vehicleId
        )).isTrue();

        expectSqlRejected("update vehicle set usage_recorded_at = null where id = ?", vehicleId);
        expectSqlRejected("update vehicle set usage_recorded_at = now() - interval '1 day' where id = ?", vehicleId);
        expectSqlRejected("delete from vehicle where id = ?", vehicleId);

        // An erasure context must name an open, identity-verified ERASURE request of the owner.
        jdbcTemplate.execute("select set_config('servisimibul.erasure_request_id', gen_random_uuid()::text, true)");
        expectSqlRejected("delete from vehicle where id = ?", vehicleId);
        UUID requestId = UUID.randomUUID();
        jdbcTemplate.update("""
                insert into data_rights_request (id, requester_id, request_type, details, status,
                    received_at, response_due_at, identity_verified_at, identity_verified_by,
                    version, updated_at)
                values (?, ?, 'ERASURE', 'synthetic erasure request', 'UNDER_REVIEW',
                    now(), now() + interval '720 hours', now(), ?, 0, now())
                """, requestId, fixture.user().getId(), fixture.user().getId());
        jdbcTemplate.execute("select set_config('servisimibul.erasure_request_id', '" + requestId + "', true)");
        assertThat(jdbcTemplate.update("delete from vehicle where id = ?", vehicleId)).isEqualTo(1);
        jdbcTemplate.execute("select set_config('servisimibul.erasure_request_id', '', true)");
    }

    @Test
    void databaseRestrictsDeletingReferencedVehicle() {
        Fixture fixture = createFixture("delete-fk@example.com", "Delete Fk", "34HHH008");
        offeringRepository.saveAndFlush(new ServiceOffering(
                fixture.operatorSchool(),
                fixture.vehicle(),
                null,
                null
        ));

        assertThatThrownBy(() -> jdbcTemplate.update(
                        "delete from vehicle where id = ?",
                        fixture.vehicle().getId()
                ))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void vehicleDeletionRequiresOwnershipCsrfAndOperatorSession() throws Exception {
        Fixture owner = createFixture("delete-owner@example.com", "Delete Owner", "34JJJ009");
        AppUser intruder = createOperator("delete-intruder@example.com", "Delete Intruder");

        mockMvc.perform(delete("/api/v1/operator/vehicles/{id}", owner.vehicle().getId())
                        .with(asOperator(intruder))
                        .with(csrf()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("vehicle_not_found"));
        mockMvc.perform(delete("/api/v1/operator/vehicles/{id}", owner.vehicle().getId())
                        .with(asOperator(owner.user())))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/v1/operator/vehicles/{id}", owner.vehicle().getId())
                        .with(csrf()))
                .andExpect(status().isUnauthorized());

        entityManager.clear();
        assertThat(vehicleRepository.findById(owner.vehicle().getId())).isPresent();
    }

    private void expectDeleteConflict(Fixture fixture, Vehicle vehicle, String code) throws Exception {
        mockMvc.perform(delete("/api/v1/operator/vehicles/{id}", vehicle.getId())
                        .with(asOperator(fixture.user()))
                        .with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(code));
        entityManager.clear();
        assertThat(vehicleRepository.findById(vehicle.getId())).isPresent();
    }

    private void expectSqlRejected(String sql, Object... arguments) {
        jdbcTemplate.execute("savepoint vehicle_guard_probe");
        assertThatThrownBy(() -> jdbcTemplate.update(sql, arguments))
                .isInstanceOf(DataIntegrityViolationException.class);
        jdbcTemplate.execute("rollback to savepoint vehicle_guard_probe");
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
