package com.servisimibul.backend.geography.dto;

import com.fasterxml.jackson.annotation.JsonSetter;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public final class SchoolPatchRequest {

    private boolean neighborhoodIdPresent;
    @Positive
    private Long neighborhoodId;

    private boolean namePresent;
    @Size(max = 255)
    private String name;

    private boolean addressPresent;
    private String address;

    private boolean sourceNamePresent;
    @Size(max = 100)
    private String sourceName;

    private boolean sourceCodePresent;
    @Size(max = 100)
    private String sourceCode;

    private boolean activePresent;
    private Boolean active;

    @JsonSetter("neighborhoodId")
    public void setNeighborhoodId(Long neighborhoodId) {
        neighborhoodIdPresent = true;
        this.neighborhoodId = neighborhoodId;
    }

    @JsonSetter("name")
    public void setName(String name) {
        namePresent = true;
        this.name = name;
    }

    @JsonSetter("address")
    public void setAddress(String address) {
        addressPresent = true;
        this.address = address;
    }

    @JsonSetter("sourceName")
    public void setSourceName(String sourceName) {
        sourceNamePresent = true;
        this.sourceName = sourceName;
    }

    @JsonSetter("sourceCode")
    public void setSourceCode(String sourceCode) {
        sourceCodePresent = true;
        this.sourceCode = sourceCode;
    }

    @JsonSetter("active")
    public void setActive(Boolean active) {
        activePresent = true;
        this.active = active;
    }

    public boolean hasNeighborhoodId() {
        return neighborhoodIdPresent;
    }

    public Long neighborhoodId() {
        return neighborhoodId;
    }

    public boolean hasName() {
        return namePresent;
    }

    public String name() {
        return name;
    }

    public boolean hasAddress() {
        return addressPresent;
    }

    public String address() {
        return address;
    }

    public boolean hasSourceName() {
        return sourceNamePresent;
    }

    public String sourceName() {
        return sourceName;
    }

    public boolean hasSourceCode() {
        return sourceCodePresent;
    }

    public String sourceCode() {
        return sourceCode;
    }

    public boolean hasActive() {
        return activePresent;
    }

    public Boolean active() {
        return active;
    }

    public boolean hasAnyField() {
        return neighborhoodIdPresent
                || namePresent
                || addressPresent
                || sourceNamePresent
                || sourceCodePresent
                || activePresent;
    }
}
