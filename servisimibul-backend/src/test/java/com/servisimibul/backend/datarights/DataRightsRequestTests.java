package com.servisimibul.backend.datarights;

import com.servisimibul.backend.identity.AppUser;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DataRightsRequestTests {

    private static final OffsetDateTime RECEIVED = OffsetDateTime.of(2026, 11, 6, 9, 0, 0, 0, ZoneOffset.UTC);
    private final AppUser requester = AppUser.newParent("requester@example.com", "hash");
    private final AppUser handler = AppUser.newOperator("handler@example.com", "hash");

    @Test
    void receiptStartsTheThirtyDayClockWithoutPausing() {
        DataRightsRequest request = newRequest();

        assertThat(request.getStatus()).isEqualTo(DataRightsRequestStatus.RECEIVED);
        assertThat(request.getResponseDueAt()).isEqualTo(RECEIVED.plusDays(30));
        assertThat(request.isOverdue(RECEIVED.plusDays(30))).isFalse();
        assertThat(request.isOverdue(RECEIVED.plusDays(30).plusSeconds(1))).isTrue();

        request.requestVerification("Kimlik teyidi gerekli", RECEIVED.plusDays(1));
        assertThat(request.getResponseDueAt()).isEqualTo(RECEIVED.plusDays(30));
        assertThat(request.isOverdue(RECEIVED.plusDays(31))).isTrue();
    }

    @Test
    void closedRequestsStayOverdueUntilDeliveryAndAcceptOnlyDeliveryOnce() {
        DataRightsRequest request = newRequest();
        request.startReview(RECEIVED);
        request.respond(null, RECEIVED.plusDays(2));

        assertThat(request.getClosedAt()).isEqualTo(RECEIVED.plusDays(2));
        assertThat(request.isOverdue(RECEIVED.plusDays(29))).isFalse();
        assertThat(request.isOverdue(RECEIVED.plusDays(31))).isTrue();
        assertInvalid(() -> request.reject("late", RECEIVED.plusDays(3)));
        assertInvalid(() -> request.startReview(RECEIVED.plusDays(3)));
        assertInvalid(() -> request.recordIdentityVerified(handler, RECEIVED.plusDays(3)));

        request.recordDelivery(RECEIVED.plusDays(3));
        assertThat(request.getResponseDeliveredAt()).isEqualTo(RECEIVED.plusDays(3));
        assertThat(request.isOverdue(RECEIVED.plusDays(60))).isFalse();
        assertInvalid(() -> request.recordDelivery(RECEIVED.plusDays(4)));
        assertInvalid(() -> request.assign(handler, RECEIVED.plusDays(4)));
    }

    @Test
    void closedUndeliveredRequestCanChangeHandlerWithoutChangingItsOutcome() {
        DataRightsRequest request = newRequest();
        request.startReview(RECEIVED);
        request.recordIdentityVerified(handler, RECEIVED.plusDays(1));
        request.respondPartially("Bir kısmı", RECEIVED.plusDays(2));

        request.assign(handler, RECEIVED.plusDays(3));

        assertThat(request.getAssignedHandler()).isSameAs(handler);
        assertThat(request.getStatus()).isEqualTo(DataRightsRequestStatus.PARTIALLY_RESPONDED);
        assertThat(request.getClosedAt()).isEqualTo(RECEIVED.plusDays(2));
        assertThat(request.getIdentityVerifiedAt()).isEqualTo(RECEIVED.plusDays(1));
        assertThat(request.getResponseDueAt()).isEqualTo(RECEIVED.plus(DataRightsRequest.STATUTORY_RESPONSE_PERIOD));
        assertThat(request.handlerNoteForHandler()).isEqualTo("Bir kısmı");
    }

    @Test
    void everyUndeliveredOutcomeStillCountsAgainstTheDeadline() {
        DataRightsRequest partial = newRequest();
        partial.startReview(RECEIVED);
        partial.respondPartially("Bir kısmı", RECEIVED.plusDays(1));
        DataRightsRequest rejected = newRequest();
        rejected.reject("Kapsam dışı", RECEIVED.plusDays(1));

        assertThat(partial.isOverdue(RECEIVED.plusDays(31))).isTrue();
        assertThat(rejected.isOverdue(RECEIVED.plusDays(31))).isTrue();

        rejected.recordDelivery(RECEIVED.plusDays(40));
        assertThat(rejected.isOverdue(RECEIVED.plusDays(41))).isFalse();
    }

    @Test
    void outcomesRequireReviewAndDeliveryRequiresAnOutcome() {
        DataRightsRequest request = newRequest();

        assertInvalid(() -> request.respond(null, RECEIVED));
        assertInvalid(() -> request.respondPartially("kısmi", RECEIVED));
        assertInvalid(() -> request.recordDelivery(RECEIVED));

        request.requestVerification("Ek bilgi", RECEIVED);
        assertInvalid(() -> request.requestVerification("Tekrar", RECEIVED));
        assertInvalid(() -> request.respond(null, RECEIVED));
        assertInvalid(() -> request.startReview(RECEIVED));

        request.recordIdentityVerified(handler, RECEIVED.plusHours(1));
        assertThat(request.getStatus()).isEqualTo(DataRightsRequestStatus.UNDER_REVIEW);
        assertThat(request.getIdentityVerifiedBy()).isSameAs(handler);
        assertInvalid(() -> request.recordIdentityVerified(handler, RECEIVED.plusHours(2)));

        request.respondPartially("Bir kısmı karşılandı", RECEIVED.plusHours(3));
        assertThat(request.getStatus()).isEqualTo(DataRightsRequestStatus.PARTIALLY_RESPONDED);
    }

    @Test
    void rejectionIsAllowedFromAnyOpenStatus() {
        DataRightsRequest request = newRequest();
        request.startReview(RECEIVED);
        request.requestVerification("Ek bilgi", RECEIVED);

        request.reject("Kapsam dışı", RECEIVED.plusHours(1));
        assertThat(request.getStatus()).isEqualTo(DataRightsRequestStatus.REJECTED);
        assertThat(request.handlerNoteForHandler()).isEqualTo("Kapsam dışı");
    }

    private DataRightsRequest newRequest() {
        return new DataRightsRequest(requester, DataRightsRequestType.ACCESS, "Verilerimi görmek istiyorum", RECEIVED);
    }

    private static void assertInvalid(Runnable action) {
        assertThatThrownBy(action::run).isInstanceOf(DataRightsRequest.InvalidTransitionException.class);
    }
}
