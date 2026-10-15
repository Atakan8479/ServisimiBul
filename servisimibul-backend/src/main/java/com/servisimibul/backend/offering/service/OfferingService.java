package com.servisimibul.backend.offering.service;

import com.servisimibul.backend.identity.OperatorProfile;
import com.servisimibul.backend.identity.OperatorProfileRepository;
import com.servisimibul.backend.offering.ServiceOffering;
import com.servisimibul.backend.offering.ServiceOfferingRepository;
import com.servisimibul.backend.offering.Vehicle;
import com.servisimibul.backend.offering.VehicleRepository;
import com.servisimibul.backend.offering.dto.ServiceOfferingDtos.CreateRequest;
import com.servisimibul.backend.offering.dto.ServiceOfferingDtos.PatchRequest;
import com.servisimibul.backend.offering.dto.ServiceOfferingDtos.ServiceOfferingResponse;
import com.servisimibul.backend.offering.dto.VehicleDtos.VehicleResponse;
import com.servisimibul.backend.offering.exception.OfferingApiException;
import com.servisimibul.backend.operatorschool.OperatorSchool;
import com.servisimibul.backend.operatorschool.OperatorSchoolRepository;
import com.servisimibul.backend.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OfferingService {

    private final CurrentUser currentUser;
    private final OperatorProfileRepository operatorProfileRepository;
    private final OperatorSchoolRepository operatorSchoolRepository;
    private final VehicleRepository vehicleRepository;
    private final ServiceOfferingRepository offeringRepository;

    @Transactional(readOnly = true)
    public List<VehicleResponse> listVehicles() {
        OperatorProfile operator = currentOperator();
        return vehicleRepository.findAllByOperatorIdOrderByPlateAscIdAsc(operator.getId()).stream()
                .map(this::toVehicleResponse)
                .toList();
    }

    @Transactional
    public VehicleResponse createVehicle(
            com.servisimibul.backend.offering.dto.VehicleDtos.CreateRequest request
    ) {
        OperatorProfile operator = currentOperator();
        String plate = normalizePlate(request.plate());
        ensurePlateAvailable(plate, null);
        Vehicle vehicle = vehicleRepository.saveAndFlush(
                new Vehicle(operator, plate, request.capacity())
        );
        return toVehicleResponse(vehicle);
    }

    @Transactional(readOnly = true)
    public VehicleResponse getVehicle(UUID id) {
        OperatorProfile operator = currentOperator();
        Vehicle vehicle = vehicleRepository.findByIdAndOperatorId(id, operator.getId())
                .orElseThrow(() -> vehicleNotFound());
        return toVehicleResponse(vehicle);
    }

    @Transactional
    public VehicleResponse patchVehicle(
            UUID id,
            com.servisimibul.backend.offering.dto.VehicleDtos.PatchRequest request
    ) {
        if (!request.hasAnyField()) {
            throw OfferingApiException.validation("request", "must contain at least one mutable field");
        }

        OperatorProfile operator = currentOperator();
        Vehicle vehicle = ownedVehicleForUpdate(id, operator.getId());
        String plate = request.hasPlate()
                ? normalizePlate(request.plate())
                : vehicle.getPlate();
        int capacity = request.hasCapacity()
                ? requiredValue(request.capacity(), "capacity")
                : vehicle.getCapacity();
        boolean active = request.hasActive()
                ? requiredValue(request.active(), "active")
                : vehicle.isActive();

        ensurePlateAvailable(plate, vehicle.getId());
        if (capacity <= 0) {
            throw OfferingApiException.validation("capacity", "must be greater than zero");
        }
        if (offeringRepository.existsByVehicleIdAndAvailableSeatsGreaterThan(vehicle.getId(), capacity)) {
            throw OfferingApiException.conflict(
                    "vehicle_capacity_in_use",
                    "Capacity cannot be lower than an existing offering's available seats"
            );
        }

        vehicle.update(plate, capacity);
        if (active) {
            vehicle.activate();
        } else {
            deactivateVehicleAndOfferings(vehicle);
        }
        vehicleRepository.flush();
        return toVehicleResponse(vehicle);
    }

    @Transactional
    public VehicleResponse deactivateVehicle(UUID id) {
        OperatorProfile operator = currentOperator();
        Vehicle vehicle = ownedVehicleForUpdate(id, operator.getId());
        deactivateVehicleAndOfferings(vehicle);
        vehicleRepository.flush();
        return toVehicleResponse(vehicle);
    }

    @Transactional(readOnly = true)
    public List<ServiceOfferingResponse> listOfferings() {
        OperatorProfile operator = currentOperator();
        return offeringRepository.findAllDetailedByOperatorId(operator.getId()).stream()
                .map(this::toOfferingResponse)
                .toList();
    }

    @Transactional
    public ServiceOfferingResponse createOffering(CreateRequest request) {
        OperatorProfile operator = currentOperator();
        Vehicle vehicle = activeOwnedVehicleForUpdate(request.vehicleId(), operator.getId());
        OperatorSchool operatorSchool = ownedOperatorSchoolForUpdate(
                request.operatorSchoolId(),
                operator.getId()
        );
        validateAvailableSeats(request.availableSeats(), vehicle.getCapacity());
        ServiceOffering offering = offeringRepository.saveAndFlush(new ServiceOffering(
                operatorSchool,
                vehicle,
                request.availableSeats(),
                normalizeDescription(request.description())
        ));
        return toOfferingResponse(offering);
    }

    @Transactional(readOnly = true)
    public ServiceOfferingResponse getOffering(UUID id) {
        OperatorProfile operator = currentOperator();
        ServiceOffering offering = offeringRepository.findDetailedOwned(id, operator.getId())
                .orElseThrow(() -> offeringNotFound());
        return toOfferingResponse(offering);
    }

    @Transactional
    public ServiceOfferingResponse patchOffering(UUID id, PatchRequest request) {
        if (!request.hasAnyField()) {
            throw OfferingApiException.validation("request", "must contain at least one mutable field");
        }

        OperatorProfile operator = currentOperator();
        ServiceOffering offering = ownedOfferingForUpdate(id, operator.getId());
        Vehicle vehicle = request.hasVehicleId()
                ? activeOwnedVehicleForUpdate(
                        requiredValue(request.vehicleId(), "vehicleId"),
                        operator.getId()
                )
                : activeOwnedVehicleForUpdate(offering.getVehicle().getId(), operator.getId());
        OperatorSchool operatorSchool = request.hasOperatorSchoolId()
                ? ownedOperatorSchoolForUpdate(
                        requiredValue(request.operatorSchoolId(), "operatorSchoolId"),
                        operator.getId()
                )
                : offering.getOperatorSchool();
        Integer availableSeats = request.hasAvailableSeats()
                ? request.availableSeats()
                : offering.getAvailableSeats();
        String description = request.hasDescription()
                ? normalizeDescription(request.description())
                : offering.getDescription();

        validateAvailableSeats(availableSeats, vehicle.getCapacity());
        boolean relationshipChanged = !vehicle.getId().equals(offering.getVehicle().getId())
                || !operatorSchool.getId().equals(offering.getOperatorSchool().getId());
        offering.update(
                operatorSchool,
                vehicle,
                availableSeats,
                description,
                relationshipChanged
        );
        offeringRepository.flush();
        return toOfferingResponse(offering);
    }

    @Transactional
    public ServiceOfferingResponse publishOffering(UUID id) {
        OperatorProfile operator = currentOperator();
        ServiceOffering offering = ownedOfferingForUpdate(id, operator.getId());
        Vehicle vehicle = activeOwnedVehicleForUpdate(offering.getVehicle().getId(), operator.getId());
        OperatorSchool operatorSchool = ownedOperatorSchoolForUpdate(
                offering.getOperatorSchool().getId(),
                operator.getId()
        );
        if (!operatorSchool.isActive() || !operatorSchool.getSchool().isActive()) {
            throw OfferingApiException.conflict(
                    "operator_school_inactive",
                    "An offering requires an active operator-school relationship and school"
            );
        }
        validateAvailableSeats(offering.getAvailableSeats(), vehicle.getCapacity());

        // A-07 owns ServiceOfferingCoverage. Until it exists, publication must fail closed
        // rather than temporarily violating J-02's mandatory coverage rule.
        throw OfferingApiException.conflict(
                "offering_coverage_required",
                "At least one valid offering coverage item is required before publication"
        );
    }

    @Transactional
    public ServiceOfferingResponse unpublishOffering(UUID id) {
        OperatorProfile operator = currentOperator();
        ServiceOffering offering = ownedOfferingForUpdate(id, operator.getId());
        offering.unpublish();
        offeringRepository.flush();
        return toOfferingResponse(offering);
    }

    private OperatorProfile currentOperator() {
        return operatorProfileRepository.findByUserId(currentUser.id())
                .orElseThrow(() -> OfferingApiException.notFound(
                        "operator_profile_not_found",
                        "Operator profile was not found"
                ));
    }

    private Vehicle ownedVehicleForUpdate(UUID id, UUID operatorId) {
        return vehicleRepository.findOwnedForUpdate(id, operatorId)
                .orElseThrow(() -> vehicleNotFound());
    }

    private Vehicle activeOwnedVehicleForUpdate(UUID id, UUID operatorId) {
        Vehicle vehicle = ownedVehicleForUpdate(id, operatorId);
        if (!vehicle.isActive()) {
            throw OfferingApiException.conflict(
                    "vehicle_inactive",
                    "An offering requires an active vehicle"
            );
        }
        return vehicle;
    }

    private OperatorSchool ownedOperatorSchoolForUpdate(UUID id, UUID operatorId) {
        return operatorSchoolRepository.findOwnedForUpdate(id, operatorId)
                .orElseThrow(() -> OfferingApiException.notFound(
                        "operator_school_not_found",
                        "Operator school relationship was not found"
                ));
    }

    private ServiceOffering ownedOfferingForUpdate(UUID id, UUID operatorId) {
        return offeringRepository.findOwnedForUpdate(id, operatorId)
                .orElseThrow(() -> offeringNotFound());
    }

    private void deactivateVehicleAndOfferings(Vehicle vehicle) {
        vehicle.deactivate();
        offeringRepository.unpublishAllByVehicleId(vehicle.getId());
    }

    private String normalizePlate(String rawPlate) {
        if (rawPlate == null) {
            throw OfferingApiException.validation("plate", "must not be null");
        }
        String plate = rawPlate.strip()
                .toUpperCase(Locale.ROOT)
                .replaceAll("[\\s-]+", "");
        if (plate.isBlank()) {
            throw OfferingApiException.validation("plate", "must not be blank");
        }
        return plate;
    }

    private void ensurePlateAvailable(String plate, UUID vehicleId) {
        boolean duplicate = vehicleId == null
                ? vehicleRepository.existsByPlate(plate)
                : vehicleRepository.existsByPlateAndIdNot(plate, vehicleId);
        if (duplicate) {
            throw OfferingApiException.conflict(
                    "vehicle_plate_conflict",
                    "A vehicle with the same normalized plate already exists"
            );
        }
    }

    private void validateAvailableSeats(Integer availableSeats, int capacity) {
        if (availableSeats == null) {
            return;
        }
        if (availableSeats < 0) {
            throw OfferingApiException.validation("availableSeats", "must be zero or greater");
        }
        if (availableSeats > capacity) {
            throw OfferingApiException.validation(
                    "availableSeats",
                    "must not exceed vehicle capacity"
            );
        }
    }

    private String normalizeDescription(String description) {
        if (description == null) {
            return null;
        }
        String normalized = description.strip();
        return normalized.isEmpty() ? null : normalized;
    }

    private <T> T requiredValue(T value, String field) {
        if (value == null) {
            throw OfferingApiException.validation(field, "must not be null");
        }
        return value;
    }

    private OfferingApiException vehicleNotFound() {
        return OfferingApiException.notFound(
                "vehicle_not_found",
                "Vehicle was not found"
        );
    }

    private OfferingApiException offeringNotFound() {
        return OfferingApiException.notFound(
                "offering_not_found",
                "Service offering was not found"
        );
    }

    private VehicleResponse toVehicleResponse(Vehicle vehicle) {
        return new VehicleResponse(
                vehicle.getId(),
                vehicle.getPlate(),
                vehicle.getCapacity(),
                vehicle.isActive(),
                vehicle.getCreatedAt(),
                vehicle.getUpdatedAt()
        );
    }

    private ServiceOfferingResponse toOfferingResponse(ServiceOffering offering) {
        return new ServiceOfferingResponse(
                offering.getId(),
                offering.getOperatorSchool().getId(),
                offering.getOperatorSchool().getSchool().getId(),
                offering.getOperatorSchool().getSchool().getName(),
                offering.getVehicle().getId(),
                offering.getVehicle().getPlate(),
                offering.getVehicle().getCapacity(),
                offering.getAvailableSeats(),
                offering.getDescription(),
                offering.isPublished(),
                offering.getCreatedAt(),
                offering.getUpdatedAt()
        );
    }
}
