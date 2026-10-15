package com.servisimibul.backend.offering.dto;

import com.fasterxml.jackson.annotation.JsonSetter;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.time.OffsetDateTime;
import java.util.UUID;

public final class ServiceOfferingDtos {

    private ServiceOfferingDtos() {
    }

    public record CreateRequest(
            @NotNull UUID operatorSchoolId,
            @NotNull UUID vehicleId,
            @PositiveOrZero Integer availableSeats,
            String description
    ) {
    }

    public static final class PatchRequest {

        private boolean operatorSchoolIdPresent;
        private UUID operatorSchoolId;
        private boolean vehicleIdPresent;
        private UUID vehicleId;
        private boolean availableSeatsPresent;
        @PositiveOrZero
        private Integer availableSeats;
        private boolean descriptionPresent;
        private String description;

        @JsonSetter("operatorSchoolId")
        public void setOperatorSchoolId(UUID operatorSchoolId) {
            operatorSchoolIdPresent = true;
            this.operatorSchoolId = operatorSchoolId;
        }

        @JsonSetter("vehicleId")
        public void setVehicleId(UUID vehicleId) {
            vehicleIdPresent = true;
            this.vehicleId = vehicleId;
        }

        @JsonSetter("availableSeats")
        public void setAvailableSeats(Integer availableSeats) {
            availableSeatsPresent = true;
            this.availableSeats = availableSeats;
        }

        @JsonSetter("description")
        public void setDescription(String description) {
            descriptionPresent = true;
            this.description = description;
        }

        public boolean hasOperatorSchoolId() {
            return operatorSchoolIdPresent;
        }

        public UUID operatorSchoolId() {
            return operatorSchoolId;
        }

        public boolean hasVehicleId() {
            return vehicleIdPresent;
        }

        public UUID vehicleId() {
            return vehicleId;
        }

        public boolean hasAvailableSeats() {
            return availableSeatsPresent;
        }

        public Integer availableSeats() {
            return availableSeats;
        }

        public boolean hasDescription() {
            return descriptionPresent;
        }

        public String description() {
            return description;
        }

        public boolean hasAnyField() {
            return operatorSchoolIdPresent
                    || vehicleIdPresent
                    || availableSeatsPresent
                    || descriptionPresent;
        }
    }

    public record ServiceOfferingResponse(
            UUID id,
            UUID operatorSchoolId,
            UUID schoolId,
            String schoolName,
            UUID vehicleId,
            String vehiclePlate,
            int vehicleCapacity,
            Integer availableSeats,
            String description,
            boolean published,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt
    ) {
    }
}
