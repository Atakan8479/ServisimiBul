package com.servisimibul.backend.demand.comment;

import com.servisimibul.backend.demand.Demand;
import com.servisimibul.backend.demand.DemandRepository;
import com.servisimibul.backend.demand.DemandSupport;
import com.servisimibul.backend.demand.DemandSupportRepository;
import com.servisimibul.backend.demand.SupportReason;
import com.servisimibul.backend.demand.comment.dto.DemandCommentDtos.CreateRequest;
import com.servisimibul.backend.demand.comment.exception.DemandCommentApiException;
import com.servisimibul.backend.demand.comment.service.DemandCommentService;
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
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
class DemandCommentConcurrencyTests {

    @Autowired
    private DemandCommentService commentService;
    @Autowired
    private TransactionTemplate transactionTemplate;
    @Autowired
    private DemandCommentRepository commentRepository;
    @Autowired
    private DemandSupportRepository supportRepository;
    @Autowired
    private DemandRepository demandRepository;
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
    private UUID parentId;
    private UUID supportId;
    private UUID schoolId;
    private Long neighborhoodId;
    private Long districtId;
    private Long provinceId;

    @AfterEach
    void cleanUpCommittedFixture() {
        transactionTemplate.executeWithoutResult(status -> {
            commentRepository.findAll().stream()
                    .filter(comment -> comment.getDemand().getId().equals(demandId))
                    .forEach(commentRepository::delete);
            commentRepository.flush();
            if (supportId != null) {
                supportRepository.deleteById(supportId);
                supportRepository.flush();
            }
            if (demandId != null) {
                demandRepository.deleteById(demandId);
                demandRepository.flush();
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
            if (parentId != null) {
                userRepository.deleteById(parentId);
                userRepository.flush();
            }
        });
    }

    @Test
    void retryWhileFirstSubmissionIsUncommittedIsRejectedAsDuplicate() throws Exception {
        createCommittedFixture();
        CreateRequest request = new CreateRequest("Aynı yorum iki kez gönderildi");
        CountDownLatch firstInserted = new CountDownLatch(1);
        CountDownLatch releaseFirst = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            // First request inserts its comment and keeps its transaction open.
            Future<?> first = executor.submit(() -> transactionTemplate.executeWithoutResult(status -> {
                commentService.create(demandId, request, parentId);
                firstInserted.countDown();
                awaitQuietly(releaseFirst);
            }));
            assertThat(firstInserted.await(10, TimeUnit.SECONDS)).isTrue();

            Future<?> retry = executor.submit(() -> commentService.create(demandId, request, parentId));
            // The retry must wait for the in-flight submission instead of passing the duplicate check.
            assertThatThrownBy(() -> retry.get(2, TimeUnit.SECONDS))
                    .isInstanceOf(TimeoutException.class);

            releaseFirst.countDown();
            first.get(20, TimeUnit.SECONDS);
            assertThatThrownBy(() -> retry.get(20, TimeUnit.SECONDS))
                    .isInstanceOf(ExecutionException.class)
                    .cause()
                    .isInstanceOfSatisfying(DemandCommentApiException.class,
                            exception -> assertThat(exception.code()).isEqualTo("duplicate_comment"));
        } finally {
            releaseFirst.countDown();
        }

        assertThat(commentRepository.findAll())
                .filteredOn(comment -> comment.getDemand().getId().equals(demandId))
                .hasSize(1);
    }

    private void createCommittedFixture() {
        transactionTemplate.executeWithoutResult(status -> {
            Province province = provinceRepository.save(new Province("97", "Istanbul"));
            District district = districtRepository.save(new District(province, "Kadikoy"));
            Neighborhood neighborhood = neighborhoodRepository.save(new Neighborhood(district, "Moda"));
            School school = schoolRepository.save(new School(
                    neighborhood, "Concurrent Comment School", null, null, null
            ));
            AppUser parent = AppUser.newParent("comment-concurrent-parent@example.com", "hash");
            parent.verifyEmail(OffsetDateTime.now());
            userRepository.save(parent);
            Demand demand = demandRepository.save(new Demand(school, neighborhood, "2026-2027", parent));
            DemandSupport support = supportRepository.save(new DemandSupport(
                    demand, parent, true, false, Set.of(SupportReason.NO_SUITABLE_SERVICE)
            ));

            demandId = demand.getId();
            parentId = parent.getId();
            supportId = support.getId();
            schoolId = school.getId();
            neighborhoodId = neighborhood.getId();
            districtId = district.getId();
            provinceId = province.getId();
        });
    }

    private static void awaitQuietly(CountDownLatch latch) {
        try {
            if (!latch.await(30, TimeUnit.SECONDS)) {
                throw new IllegalStateException("First submission was not released in time");
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(exception);
        }
    }
}
