package com.servisimibul.backend.datarights;

import java.util.EnumSet;
import java.util.Set;

public enum DataRightsRequestStatus {
    RECEIVED,
    UNDER_REVIEW,
    AWAITING_VERIFICATION,
    RESPONDED,
    PARTIALLY_RESPONDED,
    REJECTED;

    public static final Set<DataRightsRequestStatus> OPEN =
            EnumSet.of(RECEIVED, UNDER_REVIEW, AWAITING_VERIFICATION);

    public boolean isOpen() {
        return OPEN.contains(this);
    }
}
