package com.servisimibul.backend.offering;

import java.util.Optional;

/**
 * Why an operator may not permanently delete a vehicle (D059); absence means deletable.
 * A current reference is reported first because it is the most actionable reason.
 */
public enum VehicleDeletionBlock {
    IN_USE(
            "vehicle_in_use",
            "A vehicle referenced by a service offering cannot be deleted; deactivate it instead"
    ),
    HISTORY_UNKNOWN(
            "vehicle_history_unknown",
            "This vehicle predates usage tracking, so it cannot be deleted; deactivate it instead"
    ),
    PREVIOUSLY_USED(
            "vehicle_previously_used",
            "A vehicle that a service offering has used cannot be deleted; deactivate it instead"
    );

    private final String code;
    private final String detail;

    VehicleDeletionBlock(String code, String detail) {
        this.code = code;
        this.detail = detail;
    }

    public String code() {
        return code;
    }

    public String detail() {
        return detail;
    }

    /** Fails closed: any missing or unexpected value is treated as blocking. */
    public static Optional<VehicleDeletionBlock> of(VehicleRepository.DeletionState state) {
        if (!Boolean.FALSE.equals(state.getInUse())) {
            return Optional.of(IN_USE);
        }
        if (!Boolean.TRUE.equals(state.getHistoryComplete())) {
            return Optional.of(HISTORY_UNKNOWN);
        }
        if (!Boolean.FALSE.equals(state.getUsageRecorded())) {
            return Optional.of(PREVIOUSLY_USED);
        }
        return Optional.empty();
    }
}
