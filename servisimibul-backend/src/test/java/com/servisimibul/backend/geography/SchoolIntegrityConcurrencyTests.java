package com.servisimibul.backend.geography;

import com.servisimibul.backend.geography.dto.SchoolPatchRequest;
import com.servisimibul.backend.geography.service.GeographyCatalogService;
import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import com.servisimibul.backend.identity.OperatorProfile;
import com.servisimibul.backend.identity.OperatorProfileRepository;
import com.servisimibul.backend.identity.UserRole;
import com.servisimibul.backend.operatorschool.OperatorSchool;
import com.servisimibul.backend.operatorschool.OperatorSchoolCoverage;
import com.servisimibul.backend.operatorschool.OperatorSchoolCoverageRepository;
import com.servisimibul.backend.operatorschool.OperatorSchoolRepository;
import com.servisimibul.backend.operatorschool.dto.OperatorSchoolDtos.CoverageReplaceRequest;
import com.servisimibul.backend.operatorschool.exception.OperatorSchoolApiException;
import com.servisimibul.backend.operatorschool.service.OperatorSchoolService;
import com.servisimibul.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SchoolIntegrityConcurrencyTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private GeographyCatalogService geographyCatalogService;
    @Autowired private OperatorSchoolService operatorSchoolService;
    @Autowired private TransactionTemplate transactionTemplate;
    @Autowired private AppUserRepository userRepository;
    @Autowired private OperatorProfileRepository profileRepository;
    @Autowired private ProvinceRepository provinceRepository;
    @Autowired private DistrictRepository districtRepository;
    @Autowired private NeighborhoodRepository neighborhoodRepository;
    @Autowired private SchoolRepository schoolRepository;
    @Autowired private OperatorSchoolRepository operatorSchoolRepository;
    @Autowired private OperatorSchoolCoverageRepository coverageRepository;

    private UUID userId;
    private UUID profileId;
    private UUID relationshipId;
    private UUID schoolId;
    private Long schoolNeighborhoodId;
    private Long coverageNeighborhoodId;
    private Long foreignNeighborhoodId;
    private Long schoolDistrictId;
    private Long foreignDistrictId;
    private Long schoolProvinceId;
    private Long foreignProvinceId;

    @AfterEach
    void cleanUpCommittedFixture() {
        SecurityContextHolder.clearContext();
        transactionTemplate.executeWithoutResult(status -> {
            if (relationshipId != null) {
                operatorSchoolRepository.findById(relationshipId).ifPresent(operatorSchoolRepository::delete);
                operatorSchoolRepository.flush();
            }
            if (schoolId != null) {
                schoolRepository.deleteById(schoolId);
                schoolRepository.flush();
            }
            for (Long id : new Long[]{schoolNeighborhoodId, coverageNeighborhoodId, foreignNeighborhoodId}) {
                if (id != null) {
                    neighborhoodRepository.deleteById(id);
                }
            }
            neighborhoodRepository.flush();
            for (Long id : new Long[]{schoolDistrictId, foreignDistrictId}) {
                if (id != null) {
                    districtRepository.deleteById(id);
                }
            }
            districtRepository.flush();
            for (Long id : new Long[]{schoolProvinceId, foreignProvinceId}) {
                if (id != null) {
                    provinceRepository.deleteById(id);
                }
            }
            provinceRepository.flush();
            if (profileId != null) {
                profileRepository.deleteById(profileId);
                profileRepository.flush();
            }
            if (userId != null) {
                userRepository.deleteById(userId);
                userRepository.flush();
            }
        });
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void crossProvinceMoveWithExistingCoverageReturnsConflict() throws Exception {
        createCommittedFixture(true);

        mockMvc.perform(patch("/api/v1/admin/schools/{id}", schoolId)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"neighborhoodId": %d}
                                """.formatted(foreignNeighborhoodId)))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("school_province_change_conflict"));

        School school = transactionTemplate.execute(status -> schoolRepository.findDetailedById(schoolId).orElseThrow());
        assertThat(school.getNeighborhood().getId()).isEqualTo(schoolNeighborhoodId);
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void sameProvinceMoveAndLifecycleChangesPreserveCoverage() throws Exception {
        createCommittedFixture(true);

        mockMvc.perform(patch("/api/v1/admin/schools/{id}", schoolId)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"neighborhoodId": %d}
                                """.formatted(coverageNeighborhoodId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.neighborhoodId").value(coverageNeighborhoodId));
        mockMvc.perform(post("/api/v1/admin/schools/{id}/deactivate", schoolId).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
        mockMvc.perform(post("/api/v1/admin/schools/{id}/activate", schoolId).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));

        assertThat(coverageRepository.findAllDetailedByOperatorSchoolId(relationshipId))
                .extracting(coverage -> coverage.getNeighborhood().getId())
                .containsExactly(coverageNeighborhoodId);
    }

    @Test
    void concurrentAdminPatchesPreserveBothChanges() throws Exception {
        createCommittedFixture(false);
        CountDownLatch firstPatched = new CountDownLatch(1);
        CountDownLatch secondCompleted = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<?> first = executor.submit(() -> transactionTemplate.executeWithoutResult(status -> {
                SchoolPatchRequest request = new SchoolPatchRequest();
                request.setName("Serialized school name");
                geographyCatalogService.patchSchool(schoolId, request);
                firstPatched.countDown();
                waitUntilOrTimeout(secondCompleted, 1, TimeUnit.SECONDS);
            }));
            Future<?> second = executor.submit(() -> {
                awaitRequired(firstPatched, 10, TimeUnit.SECONDS);
                try {
                    SchoolPatchRequest request = new SchoolPatchRequest();
                    request.setAddress("Serialized school address");
                    geographyCatalogService.patchSchool(schoolId, request);
                } finally {
                    secondCompleted.countDown();
                }
            });

            first.get(20, TimeUnit.SECONDS);
            second.get(20, TimeUnit.SECONDS);
        }

        School school = transactionTemplate.execute(status -> schoolRepository.findDetailedById(schoolId).orElseThrow());
        assertThat(school.getName()).isEqualTo("Serialized school name");
        assertThat(school.getAddress()).isEqualTo("Serialized school address");
    }

    @Test
    void overlappingSchoolMoveAndCoverageReplacementCannotBreakProvinceInvariant() throws Exception {
        createCommittedFixture(false);
        CountDownLatch schoolPatched = new CountDownLatch(1);
        CountDownLatch coverageCompleted = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<?> schoolMove = executor.submit(() -> transactionTemplate.executeWithoutResult(status -> {
                SchoolPatchRequest request = new SchoolPatchRequest();
                request.setNeighborhoodId(foreignNeighborhoodId);
                geographyCatalogService.patchSchool(schoolId, request);
                schoolPatched.countDown();
                waitUntilOrTimeout(coverageCompleted, 1, TimeUnit.SECONDS);
            }));
            Future<OperatorSchoolApiException> coverageReplacement = executor.submit(() -> {
                awaitRequired(schoolPatched, 10, TimeUnit.SECONDS);
                authenticateOperator();
                try {
                    operatorSchoolService.replaceCoverage(
                            relationshipId,
                            new CoverageReplaceRequest(List.of(coverageNeighborhoodId))
                    );
                    return null;
                } catch (OperatorSchoolApiException exception) {
                    return exception;
                } finally {
                    coverageCompleted.countDown();
                    SecurityContextHolder.clearContext();
                }
            });

            schoolMove.get(20, TimeUnit.SECONDS);
            OperatorSchoolApiException rejection = coverageReplacement.get(20, TimeUnit.SECONDS);
            assertThat(rejection).isNotNull();
            assertThat(rejection.code()).isEqualTo("coverage_province_mismatch");
        }

        List<OperatorSchoolCoverage> coverage = transactionTemplate.execute(status ->
                coverageRepository.findAllDetailedByOperatorSchoolId(relationshipId)
        );
        assertThat(coverage).isEmpty();
    }

    private void createCommittedFixture(boolean withCoverage) {
        transactionTemplate.executeWithoutResult(status -> {
            String suffix = UUID.randomUUID().toString();
            AppUser user = AppUser.newOperator("school-integrity-" + suffix + "@example.com", "test-password-hash");
            user.verifyEmail(OffsetDateTime.now());
            userRepository.saveAndFlush(user);
            OperatorProfile profile = new OperatorProfile(user, "School Integrity", "+905551112233");
            profile.submit();
            profile.approve();
            profileRepository.saveAndFlush(profile);

            Province schoolProvince = provinceRepository.save(new Province("87", "School Province " + suffix));
            Province foreignProvince = provinceRepository.save(new Province("88", "Foreign Province " + suffix));
            District schoolDistrict = districtRepository.save(new District(schoolProvince, "School District " + suffix));
            District foreignDistrict = districtRepository.save(new District(foreignProvince, "Foreign District " + suffix));
            Neighborhood schoolNeighborhood = neighborhoodRepository.save(
                    new Neighborhood(schoolDistrict, "School Neighborhood " + suffix)
            );
            Neighborhood coverageNeighborhood = neighborhoodRepository.save(
                    new Neighborhood(schoolDistrict, "Coverage Neighborhood " + suffix)
            );
            Neighborhood foreignNeighborhood = neighborhoodRepository.save(
                    new Neighborhood(foreignDistrict, "Foreign Neighborhood " + suffix)
            );
            School school = schoolRepository.saveAndFlush(
                    new School(schoolNeighborhood, "Integrity School", null, null, null)
            );
            OperatorSchool relationship = operatorSchoolRepository.saveAndFlush(
                    new OperatorSchool(profile, school, true)
            );
            if (withCoverage) {
                coverageRepository.saveAndFlush(new OperatorSchoolCoverage(relationship, coverageNeighborhood));
            }

            userId = user.getId();
            profileId = profile.getId();
            relationshipId = relationship.getId();
            schoolId = school.getId();
            schoolNeighborhoodId = schoolNeighborhood.getId();
            coverageNeighborhoodId = coverageNeighborhood.getId();
            foreignNeighborhoodId = foreignNeighborhood.getId();
            schoolDistrictId = schoolDistrict.getId();
            foreignDistrictId = foreignDistrict.getId();
            schoolProvinceId = schoolProvince.getId();
            foreignProvinceId = foreignProvince.getId();
        });
    }

    private void authenticateOperator() {
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(
                        new AuthenticatedUser(
                                userId,
                                "school-integrity@example.com",
                                "test-password-hash",
                                UserRole.OPERATOR,
                                true
                        ),
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_OPERATOR"))
                )
        );
    }

    private void awaitRequired(CountDownLatch latch, long timeout, TimeUnit unit) {
        if (!waitUntilOrTimeout(latch, timeout, unit)) {
            throw new IllegalStateException("Concurrent operation did not reach the expected point in time");
        }
    }

    private boolean waitUntilOrTimeout(CountDownLatch latch, long timeout, TimeUnit unit) {
        try {
            return latch.await(timeout, unit);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(exception);
        }
    }
}
