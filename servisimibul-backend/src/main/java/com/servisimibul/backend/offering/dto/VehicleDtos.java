package com.servisimibul.backend.offering.dto;

import com.fasterxml.jackson.annotation.JsonSetter;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.time.OffsetDateTime;
import java.util.UUID;

public final class VehicleDtos {

    private VehicleDtos() {
    }

    public record CreateRequest(
            @NotBlank String plate,
            @NotNull @Positive Integer capacity
    ) {
    }

    public static final class PatchRequest {

        private boolean platePresent;
        private String plate;
        private boolean capacityPresent;
        @Positive
        private Integer capacity;
        private boolean activePresent;
        private Boolean active;

        @JsonSetter("plate")
        public void setPlate(String plate) {
            platePresent = true;
            this.plate = plate;
        }

        @JsonSetter("capacity")
        public void setCapacity(Integer capacity) {
            capacityPresent = true;
            this.capacity = capacity;
        }

        @JsonSetter("active")
        public void setActive(Boolean active) {
            activePresent = true;
            this.active = active;
        }

        public boolean hasPlate() {
            return platePresent;
        }

        public String plate() {
            return plate;
        }

        public boolean hasCapacity() {
            return capacityPresent;
        }

        public Integer capacity() {
            return capacity;
        }

        public boolean hasActive() {
            return activePresent;
        }

        public Boolean active() {
            return active;
        }

        public boolean hasAnyField() {
            return platePresent || capacityPresent || activePresent;
        }
    }

    public record VehicleResponse(
            UUID id,
            String plate,
            int capacity,
            boolean active,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt
    ) {
    }
}
