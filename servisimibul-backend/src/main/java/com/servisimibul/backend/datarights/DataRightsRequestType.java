package com.servisimibul.backend.datarights;

/**
 * PROPOSED coarse categories only. Which rights the process covers is pending counsel
 * (LEG-06 RQ2); these must be confirmed before intake is enabled. Recording an ERASURE
 * request never erases or anonymizes anything.
 */
public enum DataRightsRequestType {
    ACCESS,
    CORRECTION,
    ERASURE,
    OBJECTION,
    OTHER
}
