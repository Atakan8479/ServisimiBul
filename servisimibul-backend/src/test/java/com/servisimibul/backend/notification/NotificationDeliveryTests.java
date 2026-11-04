package com.servisimibul.backend.notification;

import com.servisimibul.backend.demand.Demand;
import com.servisimibul.backend.demand.DemandRepository;
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
import com.servisimibul.backend.identity.UserRole;
import com.servisimibul.backend.operatorschool.OperatorSchool;
import com.servisimibul.backend.operatorschool.OperatorSchoolCoverage;
import com.servisimibul.backend.operatorschool.OperatorSchoolCoverageRepository;
import com.servisimibul.backend.operatorschool.OperatorSchoolRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
class NotificationDeliveryTests {

    @Autowired private NotificationDeliveryService deliveryService;
    @Autowired private InAppNotificationRepository notificationRepository;
    @Autowired private AppUserRepository userRepository;
    @Autowired private OperatorProfileRepository profileRepository;
    @Autowired private ProvinceRepository provinceRepository;
    @Autowired private DistrictRepository districtRepository;
    @Autowired private NeighborhoodRepository neighborhoodRepository;
    @Autowired private SchoolRepository schoolRepository;
    @Autowired private OperatorSchoolRepository operatorSchoolRepository;
    @Autowired private OperatorSchoolCoverageRepository coverageRepository;
    @Autowired private DemandRepository demandRepository;
    @Autowired private NotificationPreferenceService preferenceService;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    void demandCreationTargetsExactAndPickupDistrictCoverageOnce() {
        Province province = provinceRepository.save(new Province("93", "Notification Province"));
        District schoolDistrict = districtRepository.save(new District(province, "School District"));
        District pickupDistrict = districtRepository.save(new District(province, "Pickup District"));
        District otherDistrict = districtRepository.save(new District(province, "Other District"));
        Neighborhood schoolNeighborhood = neighborhoodRepository.save(
                new Neighborhood(schoolDistrict, "School Neighborhood")
        );
        Neighborhood pickup = neighborhoodRepository.save(
                new Neighborhood(pickupDistrict, "Pickup Neighborhood")
        );
        Neighborhood sameDistrict = neighborhoodRepository.save(
                new Neighborhood(pickupDistrict, "Other Pickup Neighborhood")
        );
        Neighborhood outsideDistrict = neighborhoodRepository.saveAndFlush(
                new Neighborhood(otherDistrict, "Outside Neighborhood")
        );
        School school = schoolRepository.saveAndFlush(
                new School(schoolNeighborhood, "Notification School", null, null, null)
        );
        AppUser parent = parent();
        Demand demand = demandRepository.saveAndFlush(
                new Demand(school, pickup, "2026-2027", parent)
        );

        AppUser exact = operator("exact", school, List.of(pickup, sameDistrict), true, true);
        AppUser district = operator("district", school, List.of(sameDistrict), true, true);
        AppUser outside = operator("outside", school, List.of(outsideDistrict), true, true);
        AppUser hidden = operator("hidden", school, List.of(pickup), false, true);
        AppUser unapproved = operator("unapproved", school, List.of(pickup), true, false);
        AppUser optedOut = operator("opted-out", school, List.of(pickup), true, true);
        AppUser optedBackIn = operator("opted-back-in", school, List.of(pickup), true, true);
        preferenceService.update(optedOut.getId(), UserRole.OPERATOR, "DEMAND_CREATED", false);
        preferenceService.update(optedBackIn.getId(), UserRole.OPERATOR, "DEMAND_CREATED", false);
        preferenceService.update(optedBackIn.getId(), UserRole.OPERATOR, "DEMAND_CREATED", true);

        deliveryService.demandCreated(demand);
        deliveryService.demandCreated(demand);

        assertThat(count(exact)).isOne();
        assertThat(count(district)).isOne();
        assertThat(count(outside)).isZero();
        assertThat(count(hidden)).isZero();
        assertThat(count(unapproved)).isZero();
        assertThat(count(optedOut)).isZero();
        assertThat(count(optedBackIn)).isOne();
    }

    @Test
    void essentialNotificationTypesCannotBeStoredAsPreferences() {
        AppUser parent = parent();
        assertThatThrownBy(() -> jdbcTemplate.update(
                "insert into notification_preference (user_id, type, enabled, updated_at) values (?, ?, false, now())",
                parent.getId(), "SERVICE_PUBLISHED"
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    private long count(AppUser user) {
        return notificationRepository.countByRecipientUserIdAndType(
                user.getId(), NotificationType.DEMAND_CREATED
        );
    }

    private AppUser parent() {
        AppUser parent = AppUser.newParent("notification-parent@example.com", "test-password-hash");
        parent.verifyEmail(OffsetDateTime.now());
        return userRepository.saveAndFlush(parent);
    }

    private AppUser operator(
            String suffix,
            School school,
            List<Neighborhood> coverages,
            boolean visible,
            boolean approved
    ) {
        AppUser user = AppUser.newOperator(
                "notification-" + suffix + "@example.com",
                "test-password-hash"
        );
        user.verifyEmail(OffsetDateTime.now());
        userRepository.saveAndFlush(user);
        OperatorProfile profile = new OperatorProfile(user, "Operator " + suffix, "+9055" + digits(suffix));
        profile.update(profile.getBusinessName(), profile.getContactPhone(), null, visible);
        if (approved) {
            profile.submit();
            profile.approve();
        }
        profileRepository.saveAndFlush(profile);
        OperatorSchool operatorSchool = operatorSchoolRepository.saveAndFlush(
                new OperatorSchool(profile, school, true)
        );
        coverages.forEach(neighborhood -> coverageRepository.save(
                new OperatorSchoolCoverage(operatorSchool, neighborhood)
        ));
        coverageRepository.flush();
        return user;
    }

    private String digits(String value) {
        return "%08d".formatted(Math.floorMod(value.hashCode(), 100_000_000));
    }
}
