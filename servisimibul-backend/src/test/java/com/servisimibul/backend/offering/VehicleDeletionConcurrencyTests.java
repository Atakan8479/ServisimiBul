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
import com.servisimibul.backend.offering.dto.ServiceOfferingDtos.CreateRequest;
import com.servisimibul.backend.offering.exception.OfferingApiException;
import com.servisimibul.backend.offering.service.OfferingService;
import com.servisimibul.backend.operatorschool.OperatorSchool;
import com.servisimibul.backend.operatorschool.OperatorSchoolRepository;
import com.servisimibul.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.OffsetDateTime;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Proves that a vehicle deletion cannot race an offering that is being created for the same
 * vehicle: both paths lock the owned vehicle row, so deletion waits and then observes the
 * committed reference (D059). Uses committed synthetic fixtures that are removed afterwards.
 */
@SpringBootTest
class VehicleDeletionConcurrencyTests {

    @Autowired
    private OfferingService offeringService;
    @Autowired
    private TransactionTemplate transactionTemplate;
    @Autowired
    private JdbcTemplate jdbcTemplate;
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

    private AuthenticatedUser principal;
    private UUID operatorSchoolId;
    private UUID vehicleId;
    private UUID schoolId;
    private Long neighborhoodId;
    private Long districtId;
    private Long provinceId;

    @AfterEach
    void cleanUpCommittedFixture() {
        SecurityContextHolder.clearContext();
        if (vehicleId != null) {
            jdbcTemplate.update("delete from service_offering where vehicle_id = ?", vehicleId);
            jdbcTemplate.update("delete from vehicle where id = ?", vehicleId);
        }
        if (operatorSchoolId != null) {
            jdbcTemplate.update("delete from operator_school where id = ?", operatorSchoolId);
        }
        if (schoolId != null) {
            jdbcTemplate.update("delete from school where id = ?", schoolId);
        }
        if (neighborhoodId != null) {
            jdbcTemplate.update("delete from neighborhood where id = ?", neighborhoodId);
        }
        if (districtId != null) {
            jdbcTemplate.update("delete from district where id = ?", districtId);
        }
        if (provinceId != null) {
            jdbcTemplate.update("delete from province where id = ?", provinceId);
        }
        if (principal != null) {
            jdbcTemplate.update("delete from operator_profile where user_id = ?", principal.id());
            jdbcTemplate.update("delete from app_user where id = ?", principal.id());
        }
    }

    @Test
    void deletionWaitsForConcurrentOfferingAndThenRejectsReferencedVehicle() throws Exception {
        createCommittedFixture();
        CountDownLatch offeringInserted = new CountDownLatch(1);
        CountDownLatch releaseOffering = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            // The offering transaction locks the vehicle row and stays open.
            Future<?> offering = executor.submit(() -> asOperator(() ->
                    transactionTemplate.executeWithoutResult(status -> {
                        offeringService.createOffering(
                                new CreateRequest(operatorSchoolId, vehicleId, null, null)
                        );
                        offeringInserted.countDown();
                        awaitQuietly(releaseOffering);
                    })
            ));
            assertThat(offeringInserted.await(10, TimeUnit.SECONDS)).isTrue();

            Future<?> deletion = executor.submit(() -> asOperator(
                    () -> offeringService.deleteVehicle(vehicleId)
            ));
            // Deletion must block on the vehicle row lock instead of passing a stale reference check.
            assertThatThrownBy(() -> deletion.get(2, TimeUnit.SECONDS))
                    .isInstanceOf(TimeoutException.class);

            releaseOffering.countDown();
            offering.get(20, TimeUnit.SECONDS);
            assertThatThrownBy(() -> deletion.get(20, TimeUnit.SECONDS))
                    .isInstanceOf(ExecutionException.class)
                    .cause()
                    .isInstanceOfSatisfying(OfferingApiException.class,
                            exception -> assertThat(exception.code()).isEqualTo("vehicle_in_use"));
        } finally {
            releaseOffering.countDown();
        }

        assertThat(vehicleRepository.findById(vehicleId)).isPresent();
    }

    private void createCommittedFixture() {
        transactionTemplate.executeWithoutResult(status -> {
            AppUser user = AppUser.newOperator("delete-race@example.com", "test-password-hash");
            user.verifyEmail(OffsetDateTime.now());
            userRepository.saveAndFlush(user);
            OperatorProfile profile = new OperatorProfile(user, "Delete Race", "+905551112233");
            profile.submit();
            profile.approve();
            profileRepository.saveAndFlush(profile);
            principal = new AuthenticatedUser(
                    user.getId(),
                    user.getEmail(),
                    "test-password-hash",
                    user.getRole(),
                    true
            );

            long suffix = provinceRepository.count() + 1;
            Province province = provinceRepository.saveAndFlush(new Province(
                    String.format("%02d", suffix),
                    "Race Province " + suffix
            ));
            District district = districtRepository.saveAndFlush(new District(province, "Race District"));
            Neighborhood neighborhood = neighborhoodRepository.saveAndFlush(
                    new Neighborhood(district, "Race Neighborhood")
            );
            School school = schoolRepository.saveAndFlush(
                    new School(neighborhood, "Race School", null, null, null)
            );
            OperatorSchool operatorSchool = operatorSchoolRepository.saveAndFlush(
                    new OperatorSchool(profile, school, true)
            );
            Vehicle vehicle = vehicleRepository.saveAndFlush(new Vehicle(profile, "34RACE10", 12));

            provinceId = province.getId();
            districtId = district.getId();
            neighborhoodId = neighborhood.getId();
            schoolId = school.getId();
            operatorSchoolId = operatorSchool.getId();
            vehicleId = vehicle.getId();
        });
    }

    private void asOperator(Runnable action) {
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(
                        principal,
                        null,
                        principal.getAuthorities()
                )
        );
        try {
            action.run();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private static void awaitQuietly(CountDownLatch latch) {
        try {
            latch.await(20, TimeUnit.SECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }
}
