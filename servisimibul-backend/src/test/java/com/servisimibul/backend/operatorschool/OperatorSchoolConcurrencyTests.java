package com.servisimibul.backend.operatorschool;

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
import com.servisimibul.backend.operatorschool.dto.OperatorSchoolDtos.CoverageReplaceRequest;
import com.servisimibul.backend.operatorschool.service.OperatorSchoolService;
import com.servisimibul.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class OperatorSchoolConcurrencyTests {

    @Autowired
    private OperatorSchoolService operatorSchoolService;

    @Autowired
    private TransactionTemplate transactionTemplate;

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

    private UUID userId;
    private UUID profileId;
    private UUID relationshipId;
    private UUID schoolId;
    private Long firstNeighborhoodId;
    private Long secondNeighborhoodId;
    private Long thirdNeighborhoodId;
    private Long districtId;
    private Long provinceId;

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
            for (Long id : new Long[]{firstNeighborhoodId, secondNeighborhoodId, thirdNeighborhoodId}) {
                if (id != null) {
                    neighborhoodRepository.deleteById(id);
                }
            }
            neighborhoodRepository.flush();
            if (districtId != null) {
                districtRepository.deleteById(districtId);
                districtRepository.flush();
            }
            if (provinceId != null) {
                provinceRepository.deleteById(provinceId);
                provinceRepository.flush();
            }
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
    void concurrentCoverageReplacementsSerializeToOneCompleteSet() throws Exception {
        createCommittedFixture();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<?> first = executor.submit(() -> replaceWhenReleased(
                    ready,
                    start,
                    List.of(firstNeighborhoodId, secondNeighborhoodId)
            ));
            Future<?> second = executor.submit(() -> replaceWhenReleased(
                    ready,
                    start,
                    List.of(thirdNeighborhoodId)
            ));

            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            first.get(20, TimeUnit.SECONDS);
            second.get(20, TimeUnit.SECONDS);
        }

        Set<Long> finalCoverage = transactionTemplate.execute(status ->
                coverageRepository.findAllDetailedByOperatorSchoolId(relationshipId).stream()
                        .map(coverage -> coverage.getNeighborhood().getId())
                        .collect(java.util.stream.Collectors.toSet())
        );
        assertThat(finalCoverage).isIn(
                Set.of(firstNeighborhoodId, secondNeighborhoodId),
                Set.of(thirdNeighborhoodId)
        );
    }

    private void createCommittedFixture() {
        transactionTemplate.executeWithoutResult(status -> {
            AppUser user = AppUser.newOperator(
                    "concurrent-coverage@example.com",
                    "test-password-hash"
            );
            user.verifyEmail(java.time.OffsetDateTime.now());
            userRepository.saveAndFlush(user);
            OperatorProfile profile = new OperatorProfile(
                    user,
                    "Concurrent Coverage",
                    "+905551112233"
            );
            profile.submit();
            profile.approve();
            profileRepository.saveAndFlush(profile);
            Province province = provinceRepository.save(new Province("34", "Istanbul"));
            District district = districtRepository.save(new District(province, "Kadikoy"));
            Neighborhood first = neighborhoodRepository.save(new Neighborhood(district, "Caferaga"));
            Neighborhood second = neighborhoodRepository.save(new Neighborhood(district, "Fenerbahce"));
            Neighborhood third = neighborhoodRepository.save(new Neighborhood(district, "Goztepe"));
            School school = schoolRepository.saveAndFlush(
                    new School(first, "Concurrent School", null, null, null)
            );
            OperatorSchool relationship = operatorSchoolRepository.saveAndFlush(
                    new OperatorSchool(profile, school, true)
            );

            userId = user.getId();
            profileId = profile.getId();
            relationshipId = relationship.getId();
            schoolId = school.getId();
            firstNeighborhoodId = first.getId();
            secondNeighborhoodId = second.getId();
            thirdNeighborhoodId = third.getId();
            districtId = district.getId();
            provinceId = province.getId();
        });
    }

    private void replaceWhenReleased(
            CountDownLatch ready,
            CountDownLatch start,
            List<Long> neighborhoodIds
    ) {
        try {
            SecurityContextHolder.getContext().setAuthentication(
                    UsernamePasswordAuthenticationToken.authenticated(
                            new AuthenticatedUser(
                                    userId,
                                    "concurrent-coverage@example.com",
                                    "test-password-hash",
                                    com.servisimibul.backend.identity.UserRole.OPERATOR,
                                    true
                            ),
                            null,
                            List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority(
                                    "ROLE_OPERATOR"
                            ))
                    )
            );
            ready.countDown();
            if (!start.await(10, TimeUnit.SECONDS)) {
                throw new IllegalStateException("Concurrent update did not start in time");
            }
            operatorSchoolService.replaceCoverage(
                    relationshipId,
                    new CoverageReplaceRequest(neighborhoodIds)
            );
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(exception);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
