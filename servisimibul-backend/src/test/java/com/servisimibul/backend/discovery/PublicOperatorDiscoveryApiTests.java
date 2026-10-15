package com.servisimibul.backend.discovery;

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
import com.servisimibul.backend.offering.ServiceOffering;
import com.servisimibul.backend.offering.ServiceOfferingRepository;
import com.servisimibul.backend.offering.Vehicle;
import com.servisimibul.backend.offering.VehicleRepository;
import com.servisimibul.backend.operatorschool.OperatorSchool;
import com.servisimibul.backend.operatorschool.OperatorSchoolCoverage;
import com.servisimibul.backend.operatorschool.OperatorSchoolCoverageRepository;
import com.servisimibul.backend.operatorschool.OperatorSchoolRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PublicOperatorDiscoveryApiTests {

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
    private OperatorSchoolCoverageRepository coverageRepository;

    @Autowired
    private VehicleRepository vehicleRepository;

    @Autowired
    private ServiceOfferingRepository offeringRepository;

    private int sequence;

    @Test
    void zeroVehiclesZeroOfferingsAndDraftOfferingsRemainDiscoverableWithoutSession()
            throws Exception {
        SearchContext context = createSearchContext();
        createMatchingOperator(context, "alpha@example.com", "Alpha Transport", State.PUBLISHED);

        OperatorFixture zeroOfferings = createMatchingOperator(
                context,
                "bravo@example.com",
                "Bravo Transport",
                State.PUBLISHED
        );
        vehicleRepository.saveAndFlush(new Vehicle(
                zeroOfferings.profile(),
                "34BRV002",
                12
        ));

        OperatorFixture draftOnly = createMatchingOperator(
                context,
                "charlie@example.com",
                "Charlie Transport",
                State.PUBLISHED
        );
        Vehicle vehicle = vehicleRepository.saveAndFlush(new Vehicle(
                draftOnly.profile(),
                "34CHR003",
                14
        ));
        offeringRepository.saveAndFlush(new ServiceOffering(
                draftOnly.operatorSchool(),
                vehicle,
                4,
                "Draft morning service"
        ));

        var result = mockMvc.perform(get("/api/v1/operators")
                        .param("schoolId", context.school().getId().toString())
                        .param("neighborhoodId", context.coverageNeighborhood().getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(3))
                .andExpect(jsonPath("$.content[0].businessName").value("Alpha Transport"))
                .andExpect(jsonPath("$.content[1].businessName").value("Bravo Transport"))
                .andExpect(jsonPath("$.content[2].businessName").value("Charlie Transport"))
                .andExpect(jsonPath("$.content[0].contactPhone").value("+905551112233"))
                .andExpect(jsonPath("$.content[0].publicEmail").doesNotExist())
                .andExpect(jsonPath("$.content[0].matchingSchool.id")
                        .value(context.school().getId().toString()))
                .andExpect(jsonPath("$.content[0].matchingSchool.name")
                        .value(context.school().getName()))
                .andExpect(jsonPath("$.content[0].publishedOfferings").isEmpty())
                .andExpect(jsonPath("$.content[1].publishedOfferings").isEmpty())
                .andExpect(jsonPath("$.content[2].publishedOfferings").isEmpty())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(1))
                .andReturn();

        assertThat(result.getRequest().getSession(false)).isNull();
    }

    @Test
    void wrongSchoolOrNeighborhoodIsExcludedAndCrossDistrictSameProvinceIsIncluded()
            throws Exception {
        SearchContext context = createSearchContext();
        OperatorFixture matching = createMatchingOperator(
                context,
                "cross-district@example.com",
                "Cross District Transport",
                State.PUBLISHED
        );

        mockMvc.perform(get("/api/v1/operators")
                        .param("schoolId", context.school().getId().toString())
                        .param("neighborhoodId", context.coverageNeighborhood().getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].operatorId")
                        .value(matching.profile().getId().toString()));

        mockMvc.perform(get("/api/v1/operators")
                        .param("schoolId", context.otherSchool().getId().toString())
                        .param("neighborhoodId", context.coverageNeighborhood().getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty());

        mockMvc.perform(get("/api/v1/operators")
                        .param("schoolId", context.school().getId().toString())
                        .param("neighborhoodId", context.wrongNeighborhood().getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty());

        SearchContext otherProvince = createSearchContext();
        coverageRepository.saveAndFlush(new OperatorSchoolCoverage(
                matching.operatorSchool(),
                otherProvince.coverageNeighborhood()
        ));
        mockMvc.perform(get("/api/v1/operators")
                        .param("schoolId", context.school().getId().toString())
                        .param(
                                "neighborhoodId",
                                otherProvince.coverageNeighborhood().getId().toString()
                        ))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty());
    }

    @Test
    void completePublicationPredicateExcludesEveryNonPublicLifecycleState() throws Exception {
        SearchContext context = createSearchContext();
        createMatchingOperator(context, "visible@example.com", "Visible", State.PUBLISHED);
        createMatchingOperator(context, "hidden@example.com", "Hidden", State.HIDDEN);
        createMatchingOperator(context, "inactive@example.com", "Inactive", State.INACTIVE);
        createMatchingOperator(context, "suspended@example.com", "Suspended", State.SUSPENDED);
        createMatchingOperator(context, "unapproved@example.com", "Unapproved", State.UNAPPROVED);
        createMatchingOperator(context, "disabled@example.com", "Disabled", State.DISABLED);
        createMatchingOperator(context, "unverified@example.com", "Unverified", State.UNVERIFIED);
        createMatchingOperator(
                context,
                "inactive-link@example.com",
                "Inactive Link",
                State.INACTIVE_OPERATOR_SCHOOL
        );

        mockMvc.perform(get("/api/v1/operators")
                        .param("schoolId", context.school().getId().toString())
                        .param("neighborhoodId", context.coverageNeighborhood().getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].businessName").value("Visible"))
                .andExpect(jsonPath("$.totalElements").value(1));

        SearchContext inactiveSchoolContext = createSearchContext();
        createMatchingOperator(
                inactiveSchoolContext,
                "inactive-school@example.com",
                "Inactive School",
                State.PUBLISHED
        );
        inactiveSchoolContext.school().deactivate();
        schoolRepository.flush();

        mockMvc.perform(get("/api/v1/operators")
                        .param("schoolId", inactiveSchoolContext.school().getId().toString())
                        .param(
                                "neighborhoodId",
                                inactiveSchoolContext.coverageNeighborhood().getId().toString()
                        ))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("school_not_found"));
    }

    @Test
    void duplicateRelatedRowsDoNotDuplicateOperatorsAndPaginationIsStable() throws Exception {
        SearchContext context = createSearchContext();
        OperatorFixture alpha = createMatchingOperator(
                context,
                "stable-alpha@example.com",
                "Alpha",
                State.PUBLISHED
        );
        createMatchingOperator(context, "stable-beta@example.com", "Beta", State.PUBLISHED);
        coverageRepository.saveAndFlush(new OperatorSchoolCoverage(
                alpha.operatorSchool(),
                context.wrongNeighborhood()
        ));
        Vehicle firstVehicle = vehicleRepository.saveAndFlush(new Vehicle(
                alpha.profile(),
                "34DUP001",
                10
        ));
        Vehicle secondVehicle = vehicleRepository.saveAndFlush(new Vehicle(
                alpha.profile(),
                "34DUP002",
                11
        ));
        offeringRepository.saveAndFlush(new ServiceOffering(
                alpha.operatorSchool(),
                firstVehicle,
                null,
                "First draft"
        ));
        offeringRepository.saveAndFlush(new ServiceOffering(
                alpha.operatorSchool(),
                secondVehicle,
                null,
                "Second draft"
        ));

        mockMvc.perform(get("/api/v1/operators")
                        .param("schoolId", context.school().getId().toString())
                        .param("neighborhoodId", context.coverageNeighborhood().getId().toString())
                        .param("page", "0")
                        .param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].businessName").value("Alpha"))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2));

        mockMvc.perform(get("/api/v1/operators")
                        .param("schoolId", context.school().getId().toString())
                        .param("neighborhoodId", context.coverageNeighborhood().getId().toString())
                        .param("page", "1")
                        .param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].businessName").value("Beta"))
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void invalidParametersAndUnknownReferencesReturnScopedProblemDetails() throws Exception {
        SearchContext context = createSearchContext();

        mockMvc.perform(get("/api/v1/operators")
                        .param("neighborhoodId", context.coverageNeighborhood().getId().toString()))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("missing_parameter"))
                .andExpect(jsonPath("$.fieldErrors.schoolId").value("is required"));

        mockMvc.perform(get("/api/v1/operators")
                        .param("schoolId", "not-a-uuid")
                        .param("neighborhoodId", context.coverageNeighborhood().getId().toString()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("invalid_parameter"));

        mockMvc.perform(get("/api/v1/operators")
                        .param("schoolId", context.school().getId().toString())
                        .param("neighborhoodId", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.neighborhoodId").exists());

        mockMvc.perform(get("/api/v1/operators")
                        .param("schoolId", context.school().getId().toString())
                        .param("neighborhoodId", context.coverageNeighborhood().getId().toString())
                        .param("page", "-1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.page").exists());

        mockMvc.perform(get("/api/v1/operators")
                        .param("schoolId", context.school().getId().toString())
                        .param("neighborhoodId", context.coverageNeighborhood().getId().toString())
                        .param("size", "51"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.size").exists());

        mockMvc.perform(get("/api/v1/operators")
                        .param("schoolId", UUID.randomUUID().toString())
                        .param("neighborhoodId", context.coverageNeighborhood().getId().toString()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("school_not_found"));

        mockMvc.perform(get("/api/v1/operators")
                        .param("schoolId", context.school().getId().toString())
                        .param("neighborhoodId", "999999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("neighborhood_not_found"));
    }

    private SearchContext createSearchContext() {
        int suffix = ++sequence;
        Province province = provinceRepository.save(new Province(
                String.format("%02d", suffix),
                "Province " + suffix
        ));
        District schoolDistrict = districtRepository.save(new District(
                province,
                "School District " + suffix
        ));
        District coverageDistrict = districtRepository.save(new District(
                province,
                "Coverage District " + suffix
        ));
        Neighborhood schoolNeighborhood = neighborhoodRepository.save(new Neighborhood(
                schoolDistrict,
                "School Neighborhood " + suffix
        ));
        Neighborhood coverageNeighborhood = neighborhoodRepository.save(new Neighborhood(
                coverageDistrict,
                "Coverage Neighborhood " + suffix
        ));
        Neighborhood wrongNeighborhood = neighborhoodRepository.saveAndFlush(new Neighborhood(
                schoolDistrict,
                "Wrong Neighborhood " + suffix
        ));
        School school = schoolRepository.save(new School(
                schoolNeighborhood,
                "School " + suffix,
                null,
                null,
                null
        ));
        School otherSchool = schoolRepository.saveAndFlush(new School(
                schoolNeighborhood,
                "Other School " + suffix,
                null,
                null,
                null
        ));
        return new SearchContext(
                school,
                otherSchool,
                coverageNeighborhood,
                wrongNeighborhood
        );
    }

    private OperatorFixture createMatchingOperator(
            SearchContext context,
            String email,
            String businessName,
            State state
    ) {
        AppUser user = AppUser.newOperator(email, "test-password-hash");
        if (state != State.UNVERIFIED) {
            user.verifyEmail(OffsetDateTime.now());
        }
        if (state == State.DISABLED || state == State.SUSPENDED) {
            user.disable();
        }
        userRepository.saveAndFlush(user);

        OperatorProfile profile = new OperatorProfile(user, businessName, "+905551112233");
        profile.update(
                businessName,
                "+905551112233",
                "Public operator description",
                state != State.HIDDEN
        );
        if (state != State.UNAPPROVED) {
            profile.submit();
            profile.approve();
        }
        if (state == State.INACTIVE || state == State.SUSPENDED) {
            profile.suspend();
        }
        profileRepository.saveAndFlush(profile);

        OperatorSchool operatorSchool = operatorSchoolRepository.saveAndFlush(new OperatorSchool(
                profile,
                context.school(),
                state != State.INACTIVE_OPERATOR_SCHOOL
        ));
        coverageRepository.saveAndFlush(new OperatorSchoolCoverage(
                operatorSchool,
                context.coverageNeighborhood()
        ));
        return new OperatorFixture(profile, operatorSchool);
    }

    private enum State {
        PUBLISHED,
        HIDDEN,
        INACTIVE,
        SUSPENDED,
        UNAPPROVED,
        DISABLED,
        UNVERIFIED,
        INACTIVE_OPERATOR_SCHOOL
    }

    private record SearchContext(
            School school,
            School otherSchool,
            Neighborhood coverageNeighborhood,
            Neighborhood wrongNeighborhood
    ) {
    }

    private record OperatorFixture(OperatorProfile profile, OperatorSchool operatorSchool) {
    }
}
