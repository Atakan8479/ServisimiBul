package com.servisimibul.backend.demand;

/**
 * Public demand board filter (D058). Moderation closures (ADMIN) and ARCHIVED
 * rows are never listed; they remain reachable only through their own detail link.
 */
public enum DemandListStatus {
    /** OPEN demands; the default for callers that omit the filter. */
    OPEN(true, false, false),
    /** CLOSED demands whose closure reason is FULFILLED. */
    FULFILLED(false, true, false),
    /** CLOSED demands whose closure reason is INACTIVE. */
    CLOSED(false, false, true),
    /** The union of OPEN, FULFILLED, and CLOSED. */
    ALL(true, true, true);

    private final boolean includesOpen;
    private final boolean includesFulfilled;
    private final boolean includesInactive;

    DemandListStatus(boolean includesOpen, boolean includesFulfilled, boolean includesInactive) {
        this.includesOpen = includesOpen;
        this.includesFulfilled = includesFulfilled;
        this.includesInactive = includesInactive;
    }

    public boolean includesOpen() {
        return includesOpen;
    }

    public boolean includesFulfilled() {
        return includesFulfilled;
    }

    public boolean includesInactive() {
        return includesInactive;
    }
}
