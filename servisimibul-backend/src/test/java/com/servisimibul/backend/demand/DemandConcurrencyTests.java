package com.servisimibul.backend.demand;

import com.servisimibul.backend.demand.dto.DemandDtos.CreateRequest;
import com.servisimibul.backend.demand.dto.DemandDtos.CreateResponse;
import com.servisimibul.backend.demand.dto.DemandDtos.DemandResponse;
import com.servisimibul.backend.demand.dto.DemandDtos.SupportRequest;
import com.servisimibul.backend.demand.service.DemandService;
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
class DemandConcurrencyTests {

    @Autowired
    private DemandService demandService;

    @Autowired
    private TransactionTemplate transactionTemplate;

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

    @Autowired
    private DemandLifecycleEventRepository lifecycleEventRepository;

    private UUID firstParentId;
    private UUID secondParentId;
    private UUID creatorParentId;
    private UUID schoolId;
    private Long schoolNeighborhoodId;
    private Long pickupNeighborhoodId;
    private Long districtId;
    private Long provinceId;

    @AfterEach
    void cleanUpCommittedFixture() {
        transactionTemplate.executeWithoutResult(status -> {
            supportRepository.deleteAll();
            supportRepository.flush();
            demandRepository.deleteAll();
            demandRepository.flush();
            if (schoolId != null) {
                schoolRepository.deleteById(schoolId);
                schoolRepository.flush();
            }
            for (Long id : new Long[]{schoolNeighborhoodId, pickupNeighborhoodId}) {
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
            for (UUID id : new UUID[]{firstParentId, secondParentId, creatorParentId}) {
                if (id != null) {
                    userRepository.deleteById(id);
                }
            }
            userRepository.flush();
        });
    }

    @Test
    void simultaneousCreationProducesOneDemandAndOnlyTheWinningCreatorSupport() throws Exception {
        createCommittedFixture();
        CreateRequest request = new CreateRequest(
                schoolId,
                pickupNeighborhoodId,
                true,
                false,
                List.of(SupportReason.NO_SUITABLE_SERVICE)
        );
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<CreateResponse> first = executor.submit(
                    () -> createWhenReleased(ready, start, request, firstParentId)
            );
            Future<CreateResponse> second = executor.submit(
                    () -> createWhenReleased(ready, start, request, secondParentId)
            );
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            List<CreateResponse> responses = List.of(
                    first.get(20, TimeUnit.SECONDS),
                    second.get(20, TimeUnit.SECONDS)
            );
            assertThat(responses).extracting(CreateResponse::created)
                    .containsExactlyInAnyOrder(true, false);
            assertThat(responses).extracting(response -> response.demand().id())
                    .containsOnly(responses.getFirst().demand().id());
        }

        assertThat(demandRepository.count()).isOne();
        assertThat(supportRepository.count()).isOne();
    }

    @Test
    void simultaneousNewParentsReopenAnInactiveDemandOnce() throws Exception {
        createCommittedFixture();
        UUID demandId = createThenCloseInactive();
        SupportRequest request = new SupportRequest(
                true,
                false,
                List.of(SupportReason.NO_SUITABLE_SERVICE)
        );
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<DemandResponse> first = executor.submit(
                    () -> supportWhenReleased(ready, start, demandId, request, firstParentId)
            );
            Future<DemandResponse> second = executor.submit(
                    () -> supportWhenReleased(ready, start, demandId, request, secondParentId)
            );
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            first.get(20, TimeUnit.SECONDS);
            second.get(20, TimeUnit.SECONDS);
        }

        assertThat(demandRepository.count()).isOne();
        assertThat(demandRepository.findById(demandId).orElseThrow().isOpen()).isTrue();
        assertThat(lifecycleEventRepository.countByDemandIdAndEventType(
                demandId,
                DemandLifecycleEventType.REOPENED
        )).isOne();
        assertThat(demandService.get(demandId, null).supporterCount()).isEqualTo(2);
    }

    private UUID createThenCloseInactive() {
        UUID demandId = demandService.create(new CreateRequest(
                schoolId,
                pickupNeighborhoodId,
                true,
                false,
                List.of(SupportReason.NO_SUITABLE_SERVICE)
        ), creatorParentId).demand().id();
        demandService.withdrawSupport(demandId, creatorParentId);
        return demandId;
    }

    private DemandResponse supportWhenReleased(
            CountDownLatch ready,
            CountDownLatch start,
            UUID demandId,
            SupportRequest request,
            UUID parentId
    ) {
        try {
            ready.countDown();
            if (!start.await(10, TimeUnit.SECONDS)) {
                throw new IllegalStateException("Concurrent support did not start in time");
            }
            return demandService.support(demandId, request, parentId);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(exception);
        }
    }

    private void createCommittedFixture() {
        transactionTemplate.executeWithoutResult(status -> {
            AppUser first = verifiedParent("concurrent-demand-one@example.com");
            AppUser second = verifiedParent("concurrent-demand-two@example.com");
            AppUser creator = verifiedParent("concurrent-demand-creator@example.com");
            Province province = provinceRepository.save(new Province("34", "Istanbul"));
            District district = districtRepository.save(new District(province, "Kadikoy"));
            Neighborhood schoolNeighborhood = neighborhoodRepository.save(
                    new Neighborhood(district, "Caferaga")
            );
            Neighborhood pickupNeighborhood = neighborhoodRepository.save(
                    new Neighborhood(district, "Fenerbahce")
            );
            School school = schoolRepository.saveAndFlush(
                    new School(schoolNeighborhood, "Concurrent Demand School", null, null, null)
            );

            firstParentId = first.getId();
            secondParentId = second.getId();
            creatorParentId = creator.getId();
            schoolId = school.getId();
            schoolNeighborhoodId = schoolNeighborhood.getId();
            pickupNeighborhoodId = pickupNeighborhood.getId();
            districtId = district.getId();
            provinceId = province.getId();
        });
    }

    private AppUser verifiedParent(String email) {
        AppUser parent = AppUser.newParent(email, "test-password-hash");
        parent.verifyEmail(OffsetDateTime.now());
        return userRepository.saveAndFlush(parent);
    }

    private CreateResponse createWhenReleased(
            CountDownLatch ready,
            CountDownLatch start,
            CreateRequest request,
            UUID parentId
    ) {
        try {
            ready.countDown();
            if (!start.await(10, TimeUnit.SECONDS)) {
                throw new IllegalStateException("Concurrent creation did not start in time");
            }
            return demandService.create(request, parentId);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(exception);
        }
    }
}
