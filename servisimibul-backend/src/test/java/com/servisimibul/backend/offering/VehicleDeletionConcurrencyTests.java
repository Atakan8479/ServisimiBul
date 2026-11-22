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
import com.servisimibul.backend.support.IsolatedPostgresTestDatabase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Connection;
import java.time.OffsetDateTime;
import java.util.List;
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
 * Proves vehicle deletion and offering creation serialize on the owned vehicle row in both
 * orders, and that repeated deletions delete once (D059). Uses committed synthetic fixtures that
 * are removed afterwards.
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
    private Environment environment;
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
    void cleanUpCommittedFixture() throws Exception {
        SecurityContextHolder.clearContext();
        // A used vehicle is intentionally undeletable through the runtime role (D059), so cleanup
        // of this synthetic fixture uses the verified disposable administrator connection with
        // triggers disabled for this one transaction only.
        try (Connection connection =
                     IsolatedPostgresTestDatabase.openVerifiedAdministratorConnection(environment)) {
            connection.setAutoCommit(false);
            try (var statement = connection.createStatement()) {
                statement.execute("set local session_replication_role = replica");
            }
            delete(connection, "delete from service_offering where operator_school_id = ?", operatorSchoolId);
            delete(connection, "delete from vehicle where id = ?", vehicleId);
            delete(connection, "delete from operator_school where id = ?", operatorSchoolId);
            delete(connection, "delete from school where id = ?", schoolId);
            delete(connection, "delete from neighborhood where id = ?", neighborhoodId);
            delete(connection, "delete from district where id = ?", districtId);
            delete(connection, "delete from province where id = ?", provinceId);
            if (principal != null) {
                delete(connection, "delete from operator_profile where user_id = ?", principal.id());
                delete(connection, "delete from app_user where id = ?", principal.id());
            }
            connection.commit();
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
            // Deletion must block on the vehicle row lock instead of passing a stale check.
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

    @Test
    void offeringWaitsForConcurrentDeletionAndThenFindsNoVehicle() throws Exception {
        createCommittedFixture();
        CountDownLatch vehicleDeleted = new CountDownLatch(1);
        CountDownLatch releaseDeletion = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            // The deletion transaction removes the unused vehicle and stays open.
            Future<?> deletion = executor.submit(() -> asOperator(() ->
                    transactionTemplate.executeWithoutResult(status -> {
                        offeringService.deleteVehicle(vehicleId);
                        vehicleDeleted.countDown();
                        awaitQuietly(releaseDeletion);
                    })
            ));
            assertThat(vehicleDeleted.await(10, TimeUnit.SECONDS)).isTrue();

            Future<?> offering = executor.submit(() -> asOperator(() ->
                    offeringService.createOffering(
                            new CreateRequest(operatorSchoolId, vehicleId, null, null)
                    )
            ));
            assertThatThrownBy(() -> offering.get(2, TimeUnit.SECONDS))
                    .isInstanceOf(TimeoutException.class);

            releaseDeletion.countDown();
            deletion.get(20, TimeUnit.SECONDS);
            assertThatThrownBy(() -> offering.get(20, TimeUnit.SECONDS))
                    .isInstanceOf(ExecutionException.class)
                    .cause()
                    .isInstanceOfSatisfying(OfferingApiException.class,
                            exception -> assertThat(exception.code()).isEqualTo("vehicle_not_found"));
        } finally {
            releaseDeletion.countDown();
        }

        assertThat(vehicleRepository.findById(vehicleId)).isEmpty();
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from service_offering where operator_school_id = ?",
                Integer.class,
                operatorSchoolId
        )).isZero();
    }

    @Test
    void repeatedConcurrentDeletionsDeleteOnceAndReportNotFound() throws Exception {
        createCommittedFixture();
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<Boolean> first = executor.submit(() -> deleteAfter(start));
            Future<Boolean> second = executor.submit(() -> deleteAfter(start));
            start.countDown();
            assertThat(List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(true, false);
        }
        assertThat(vehicleRepository.findById(vehicleId)).isEmpty();
    }

    private boolean deleteAfter(CountDownLatch start) throws InterruptedException {
        assertThat(start.await(10, TimeUnit.SECONDS)).isTrue();
        boolean[] deleted = {false};
        asOperator(() -> {
            try {
                offeringService.deleteVehicle(vehicleId);
                deleted[0] = true;
            } catch (OfferingApiException exception) {
                assertThat(exception.code()).isEqualTo("vehicle_not_found");
            }
        });
        return deleted[0];
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

    private static void delete(Connection connection, String sql, Object id) throws Exception {
        if (id == null) {
            return;
        }
        try (var statement = connection.prepareStatement(sql)) {
            statement.setObject(1, id);
            statement.executeUpdate();
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
