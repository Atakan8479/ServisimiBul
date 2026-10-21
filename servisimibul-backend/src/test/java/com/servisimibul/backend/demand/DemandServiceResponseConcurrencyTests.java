package com.servisimibul.backend.demand;

import com.servisimibul.backend.demand.dto.DemandServiceResponseDtos.PublishRequest;
import com.servisimibul.backend.demand.dto.DemandServiceResponseDtos.PublishResponse;
import com.servisimibul.backend.demand.service.DemandServiceResponseService;
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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class DemandServiceResponseConcurrencyTests {

    @Autowired
    private DemandServiceResponseService responseService;
    @Autowired
    private TransactionTemplate transactionTemplate;
    @Autowired
    private DemandServicePublicationEventRepository eventRepository;
    @Autowired
    private DemandServiceResponseRepository responseRepository;
    @Autowired
    private OperatorSchoolCoverageRepository coverageRepository;
    @Autowired
    private OperatorSchoolRepository operatorSchoolRepository;
    @Autowired
    private DemandRepository demandRepository;
    @Autowired
    private OperatorProfileRepository profileRepository;
    @Autowired
    private AppUserRepository userRepository;
    @Autowired
    private SchoolRepository schoolRepository;
    @Autowired
    private NeighborhoodRepository neighborhoodRepository;
    @Autowired
    private DistrictRepository districtRepository;
    @Autowired
    private ProvinceRepository provinceRepository;

    private UUID demandId;
    private UUID operatorUserId;
    private UUID operatorSchoolId;
    private UUID operatorProfileId;
    private UUID parentId;
    private UUID schoolId;
    private Long neighborhoodId;
    private Long districtId;
    private Long provinceId;

    @AfterEach
    void cleanUpCommittedFixture() {
        transactionTemplate.executeWithoutResult(status -> {
            eventRepository.deleteAll();
            eventRepository.flush();
            responseRepository.deleteAll();
            responseRepository.flush();
            if (operatorSchoolId != null) {
                coverageRepository.deleteAllByOperatorSchoolId(operatorSchoolId);
                coverageRepository.flush();
                operatorSchoolRepository.deleteById(operatorSchoolId);
                operatorSchoolRepository.flush();
            }
            if (demandId != null) {
                demandRepository.deleteById(demandId);
                demandRepository.flush();
            }
            if (operatorProfileId != null) {
                profileRepository.deleteById(operatorProfileId);
                profileRepository.flush();
            }
            if (schoolId != null) {
                schoolRepository.deleteById(schoolId);
                schoolRepository.flush();
            }
            if (neighborhoodId != null) {
                neighborhoodRepository.deleteById(neighborhoodId);
                neighborhoodRepository.flush();
            }
            if (districtId != null) {
                districtRepository.deleteById(districtId);
                districtRepository.flush();
            }
            if (provinceId != null) {
                provinceRepository.deleteById(provinceId);
                provinceRepository.flush();
            }
            for (UUID id : new UUID[]{operatorUserId, parentId}) {
                if (id != null) {
                    userRepository.deleteById(id);
                }
            }
            userRepository.flush();
        });
    }

    @Test
    void simultaneousPublishCreatesOneResponseAndOnePublicationEvent() throws Exception {
        createCommittedFixture();
        PublishRequest request = new PublishRequest(true, false);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<PublishResponse> first = executor.submit(
                    () -> publishWhenReleased(ready, start, request)
            );
            Future<PublishResponse> second = executor.submit(
                    () -> publishWhenReleased(ready, start, request)
            );
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            List<PublishResponse> results = List.of(
                    first.get(20, TimeUnit.SECONDS),
                    second.get(20, TimeUnit.SECONDS)
            );
            assertThat(results).extracting(PublishResponse::published)
                    .containsExactlyInAnyOrder(true, false);
            assertThat(results).extracting(result -> result.response().id())
                    .containsOnly(results.getFirst().response().id());
            assertThat(results).extracting(result -> result.response().publicationEventId())
                    .containsOnly(results.getFirst().response().publicationEventId());
        }

        assertThat(responseRepository.count()).isOne();
        assertThat(eventRepository.count()).isOne();
    }

    private void createCommittedFixture() {
        transactionTemplate.executeWithoutResult(status -> {
            Province province = provinceRepository.save(new Province("96", "Istanbul"));
            District district = districtRepository.save(new District(province, "Kadikoy"));
            Neighborhood neighborhood = neighborhoodRepository.save(
                    new Neighborhood(district, "Moda")
            );
            School school = schoolRepository.save(new School(
                    neighborhood,
                    "Concurrent Response School",
                    null,
                    null,
                    null
            ));
            AppUser parent = AppUser.newParent("response-concurrent-parent@example.com", "hash");
            parent.verifyEmail(OffsetDateTime.now());
            userRepository.save(parent);
            Demand demand = demandRepository.save(
                    new Demand(school, neighborhood, "2026-2027", parent)
            );

            AppUser operator = AppUser.newOperator(
                    "response-concurrent-operator@example.com",
                    "hash"
            );
            operator.verifyEmail(OffsetDateTime.now());
            userRepository.save(operator);
            OperatorProfile profile = new OperatorProfile(
                    operator,
                    "Concurrent Operator",
                    "+905551112233"
            );
            profile.submit();
            profile.approve();
            profileRepository.save(profile);
            OperatorSchool operatorSchool = operatorSchoolRepository.save(
                    new OperatorSchool(profile, school, true)
            );
            coverageRepository.save(new OperatorSchoolCoverage(operatorSchool, neighborhood));

            demandId = demand.getId();
            operatorUserId = operator.getId();
            operatorSchoolId = operatorSchool.getId();
            operatorProfileId = profile.getId();
            parentId = parent.getId();
            schoolId = school.getId();
            neighborhoodId = neighborhood.getId();
            districtId = district.getId();
            provinceId = province.getId();
        });
    }

    private PublishResponse publishWhenReleased(
            CountDownLatch ready,
            CountDownLatch start,
            PublishRequest request
    ) {
        try {
            ready.countDown();
            if (!start.await(10, TimeUnit.SECONDS)) {
                throw new IllegalStateException("Concurrent publication did not start in time");
            }
            return responseService.publish(demandId, request, operatorUserId);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(exception);
        }
    }
}
