package com.servisimibul.backend.moderation;

import com.servisimibul.backend.demand.Demand;
import com.servisimibul.backend.demand.DemandRepository;
import com.servisimibul.backend.demand.DemandSupport;
import com.servisimibul.backend.demand.DemandSupportRepository;
import com.servisimibul.backend.demand.SupportReason;
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
import com.servisimibul.backend.moderation.dto.ModerationDtos.CreateReportRequest;
import com.servisimibul.backend.moderation.dto.ModerationDtos.ReportReceipt;
import com.servisimibul.backend.moderation.service.ModerationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ModerationConcurrencyTests {

    @Autowired private TransactionTemplate transactions;
    @Autowired private ModerationService moderationService;
    @Autowired private AppUserRepository userRepository;
    @Autowired private ProvinceRepository provinceRepository;
    @Autowired private DistrictRepository districtRepository;
    @Autowired private NeighborhoodRepository neighborhoodRepository;
    @Autowired private SchoolRepository schoolRepository;
    @Autowired private DemandRepository demandRepository;
    @Autowired private DemandSupportRepository supportRepository;
    @Autowired private ContentReportRepository reportRepository;
    @Autowired private ModerationCaseRepository caseRepository;
    @Autowired private ModerationAuditEventRepository auditRepository;

    private Setup setup;

    @AfterEach
    void cleanUpCommittedFixture() {
        if (setup == null) {
            return;
        }
        transactions.executeWithoutResult(ignored -> {
            auditRepository.deleteAll();
            auditRepository.flush();
            reportRepository.deleteAll();
            reportRepository.flush();
            caseRepository.deleteAll();
            caseRepository.flush();
            supportRepository.deleteAll();
            supportRepository.flush();
            demandRepository.deleteById(setup.demandId());
            demandRepository.flush();
            schoolRepository.deleteById(setup.schoolId());
            schoolRepository.flush();
            neighborhoodRepository.deleteAllById(Set.of(
                    setup.schoolNeighborhoodId(),
                    setup.pickupNeighborhoodId()
            ));
            neighborhoodRepository.flush();
            districtRepository.deleteAllById(Set.of(
                    setup.schoolDistrictId(),
                    setup.pickupDistrictId()
            ));
            districtRepository.flush();
            provinceRepository.deleteById(setup.provinceId());
            provinceRepository.flush();
            userRepository.deleteAllById(Set.of(
                    setup.creatorId(),
                    setup.firstReporterId(),
                    setup.secondReporterId()
            ));
            userRepository.flush();
        });
    }

    @Test
    void concurrentReportersCreateOneActiveCaseWithTwoReports() throws Exception {
        setup = transactions.execute(ignored -> createSetup());
        assertThat(setup).isNotNull();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<ReportReceipt> first = executor.submit(() -> {
                ready.countDown();
                start.await();
                return report(setup.demandId(), setup.firstReporterId());
            });
            Future<ReportReceipt> second = executor.submit(() -> {
                ready.countDown();
                start.await();
                return report(setup.demandId(), setup.secondReporterId());
            });
            ready.await();
            start.countDown();

            ReportReceipt firstReceipt = first.get();
            ReportReceipt secondReceipt = second.get();
            assertThat(secondReceipt.caseId()).isEqualTo(firstReceipt.caseId());
            assertThat(reportRepository
                    .findByModerationCaseIdOrderByCreatedAtDescIdDesc(firstReceipt.caseId()))
                    .hasSize(2);
        }
    }

    private ReportReceipt report(UUID demandId, UUID reporterId) {
        return moderationService.report(new CreateReportRequest(
                ModerationTargetType.DEMAND,
                demandId,
                ReportReason.OTHER,
                "Concurrent report"
        ), reporterId);
    }

    private Setup createSetup() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Province province = provinceRepository.save(new Province("35", "Concurrency " + suffix));
        District schoolDistrict = districtRepository.save(new District(province, "School " + suffix));
        District pickupDistrict = districtRepository.save(new District(province, "Pickup " + suffix));
        Neighborhood schoolNeighborhood = neighborhoodRepository.save(
                new Neighborhood(schoolDistrict, "School neighborhood " + suffix)
        );
        Neighborhood pickup = neighborhoodRepository.save(
                new Neighborhood(pickupDistrict, "Pickup neighborhood " + suffix)
        );
        School school = schoolRepository.save(
                new School(schoolNeighborhood, "School " + suffix, null, null, null)
        );
        AppUser creator = parent("concurrency-creator-" + suffix + "@example.com");
        AppUser first = parent("concurrency-first-" + suffix + "@example.com");
        AppUser second = parent("concurrency-second-" + suffix + "@example.com");
        Demand demand = demandRepository.save(new Demand(school, pickup, "2026-2027", creator));
        supportRepository.save(new DemandSupport(
                demand,
                creator,
                true,
                false,
                Set.of(SupportReason.OTHER)
        ));
        demandRepository.flush();
        return new Setup(
                demand.getId(),
                creator.getId(),
                first.getId(),
                second.getId(),
                school.getId(),
                schoolNeighborhood.getId(),
                pickup.getId(),
                schoolDistrict.getId(),
                pickupDistrict.getId(),
                province.getId()
        );
    }

    private AppUser parent(String email) {
        AppUser user = AppUser.newParent(email, "test-password-hash");
        user.verifyEmail(OffsetDateTime.now());
        return userRepository.save(user);
    }

    private record Setup(
            UUID demandId,
            UUID creatorId,
            UUID firstReporterId,
            UUID secondReporterId,
            UUID schoolId,
            Long schoolNeighborhoodId,
            Long pickupNeighborhoodId,
            Long schoolDistrictId,
            Long pickupDistrictId,
            Long provinceId
    ) {
    }
}
