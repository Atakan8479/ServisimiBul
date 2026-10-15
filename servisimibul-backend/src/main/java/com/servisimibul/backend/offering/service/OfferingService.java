package com.servisimibul.backend.offering.service;

import com.servisimibul.backend.geography.District;
import com.servisimibul.backend.geography.Neighborhood;
import com.servisimibul.backend.geography.Province;
import com.servisimibul.backend.identity.OperatorProfile;
import com.servisimibul.backend.identity.OperatorProfileRepository;
import com.servisimibul.backend.offering.ServiceOffering;
import com.servisimibul.backend.offering.ServiceOfferingCoverage;
import com.servisimibul.backend.offering.ServiceOfferingCoverageRepository;
import com.servisimibul.backend.offering.ServiceOfferingRepository;
import com.servisimibul.backend.offering.ServiceOfferingRepository.OwnedReference;
import com.servisimibul.backend.offering.Vehicle;
import com.servisimibul.backend.offering.VehicleRepository;
import com.servisimibul.backend.offering.dto.ServiceOfferingDtos.CreateRequest;
import com.servisimibul.backend.offering.dto.ServiceOfferingDtos.CoverageReplaceRequest;
import com.servisimibul.backend.offering.dto.ServiceOfferingDtos.CoverageResponse;
import com.servisimibul.backend.offering.dto.ServiceOfferingDtos.PatchRequest;
import com.servisimibul.backend.offering.dto.ServiceOfferingDtos.ServiceOfferingResponse;
import com.servisimibul.backend.offering.dto.VehicleDtos.VehicleResponse;
import com.servisimibul.backend.offering.exception.OfferingApiException;
import com.servisimibul.backend.operatorschool.OperatorSchool;
import com.servisimibul.backend.operatorschool.OperatorSchoolCoverage;
import com.servisimibul.backend.operatorschool.OperatorSchoolCoverageRepository;
import com.servisimibul.backend.operatorschool.OperatorSchoolRepository;
import com.servisimibul.backend.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OfferingService {

    private final CurrentUser currentUser;
    private final OperatorProfileRepository operatorProfileRepository;
    private final OperatorSchoolRepository operatorSchoolRepository;
    private final VehicleRepository vehicleRepository;
    private final ServiceOfferingRepository offeringRepository;
    private final OperatorSchoolCoverageRepository generalCoverageRepository;
    private final ServiceOfferingCoverageRepository offeringCoverageRepository;

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
                .orElseThrow(this::vehicleNotFound);
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
        List<ServiceOffering> offerings = offeringRepository.findAllDetailedByOperatorId(
                operator.getId()
        );
        Map<UUID, List<ServiceOfferingCoverage>> coverageByOffering = coverageByOffering(offerings);
        return offerings.stream()
                .map(offering -> toOfferingResponse(
                        offering,
                        coverageByOffering.getOrDefault(offering.getId(), List.of())
                ))
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
        return toOfferingResponse(offering, List.of());
    }

    @Transactional(readOnly = true)
    public ServiceOfferingResponse getOffering(UUID id) {
        OperatorProfile operator = currentOperator();
        ServiceOffering offering = offeringRepository.findDetailedOwned(id, operator.getId())
                .orElseThrow(this::offeringNotFound);
        return toOfferingResponse(offering, offeringCoverage(offering.getId()));
    }

    @Transactional
    public ServiceOfferingResponse patchOffering(UUID id, PatchRequest request) {
        if (!request.hasAnyField()) {
            throw OfferingApiException.validation("request", "must contain at least one mutable field");
        }

        OperatorProfile operator = currentOperator();
        OwnedReference reference = ownedOfferingReference(id, operator.getId());
        Vehicle vehicle = request.hasVehicleId()
                ? activeOwnedVehicleForUpdate(
                        requiredValue(request.vehicleId(), "vehicleId"),
                        operator.getId()
                )
                : activeOwnedVehicleForUpdate(reference.getVehicleId(), operator.getId());
        OperatorSchool operatorSchool = request.hasOperatorSchoolId()
                ? ownedOperatorSchoolForUpdate(
                        requiredValue(request.operatorSchoolId(), "operatorSchoolId"),
                        operator.getId()
                )
                : ownedOperatorSchoolForUpdate(reference.getOperatorSchoolId(), operator.getId());
        ServiceOffering offering = ownedOfferingForUpdate(id, operator.getId());
        rejectStaleReference(
                request.hasVehicleId(),
                vehicle.getId(),
                offering.getVehicle().getId()
        );
        rejectStaleReference(
                request.hasOperatorSchoolId(),
                operatorSchool.getId(),
                offering.getOperatorSchool().getId()
        );
        Integer availableSeats = request.hasAvailableSeats()
                ? request.availableSeats()
                : offering.getAvailableSeats();
        String description = request.hasDescription()
                ? normalizeDescription(request.description())
                : offering.getDescription();

        validateAvailableSeats(availableSeats, vehicle.getCapacity());
        boolean operatorSchoolChanged = !operatorSchool.getId().equals(
                offering.getOperatorSchool().getId()
        );
        boolean relationshipChanged = !vehicle.getId().equals(offering.getVehicle().getId())
                || operatorSchoolChanged;
        offering.update(
                operatorSchool,
                vehicle,
                availableSeats,
                description,
                relationshipChanged
        );
        if (operatorSchoolChanged) {
            offeringCoverageRepository.deleteAllByOfferingId(offering.getId());
        }
        offeringRepository.flush();
        return toOfferingResponse(
                offering,
                operatorSchoolChanged ? List.of() : offeringCoverage(offering.getId())
        );
    }

    @Transactional
    public ServiceOfferingResponse replaceOfferingCoverage(
            UUID id,
            CoverageReplaceRequest request
    ) {
        OperatorProfile operator = currentOperator();
        OwnedReference reference = ownedOfferingReference(id, operator.getId());
        boolean keepingPublished = reference.isPublished() && !request.neighborhoodIds().isEmpty();
        Vehicle lockedVehicle = keepingPublished
                ? activeOwnedVehicleForUpdate(reference.getVehicleId(), operator.getId())
                : null;
        OperatorSchool operatorSchool = ownedOperatorSchoolForUpdate(
                reference.getOperatorSchoolId(),
                operator.getId()
        );
        ServiceOffering offering = ownedOfferingForUpdate(id, operator.getId());
        rejectStaleReference(false, operatorSchool.getId(), offering.getOperatorSchool().getId());

        List<Long> requestedIds = request.neighborhoodIds();
        Set<Long> distinctIds = new HashSet<>(requestedIds);
        if (distinctIds.size() != requestedIds.size()) {
            throw OfferingApiException.conflict(
                    "offering_coverage_duplicate",
                    "Offering coverage cannot contain the same neighborhood more than once"
            );
        }

        List<OperatorSchoolCoverage> generalCoverage = generalCoverageRepository
                .findAllDetailedByOperatorSchoolId(operatorSchool.getId());
        Map<Long, OperatorSchoolCoverage> generalCoverageByNeighborhood = new HashMap<>();
        generalCoverage.forEach(coverage -> generalCoverageByNeighborhood.put(
                coverage.getNeighborhood().getId(),
                coverage
        ));
        if (!generalCoverageByNeighborhood.keySet().containsAll(distinctIds)) {
            throw OfferingApiException.validation(
                    "neighborhoodIds",
                    "must contain only neighborhoods in the offering's general school coverage"
            );
        }

        offeringCoverageRepository.deleteAllByOfferingId(offering.getId());
        List<ServiceOfferingCoverage> replacements = requestedIds.stream()
                .map(generalCoverageByNeighborhood::get)
                .map(coverage -> new ServiceOfferingCoverage(offering, coverage))
                .toList();
        offeringCoverageRepository.saveAllAndFlush(replacements);

        if (replacements.isEmpty() && offering.isPublished()) {
            offering.unpublish();
        } else if (offering.isPublished()) {
            if (lockedVehicle == null
                    || !lockedVehicle.getId().equals(offering.getVehicle().getId())) {
                offering.unpublish();
            } else {
                validatePublishableOperatorSchool(operatorSchool);
                validateAvailableSeats(offering.getAvailableSeats(), lockedVehicle.getCapacity());
            }
        }
        offeringRepository.flush();
        return toOfferingResponse(offering, offeringCoverage(offering.getId()));
    }

    @Transactional
    public ServiceOfferingResponse publishOffering(UUID id) {
        OperatorProfile operator = currentOperator();
        OwnedReference reference = ownedOfferingReference(id, operator.getId());
        Vehicle vehicle = activeOwnedVehicleForUpdate(reference.getVehicleId(), operator.getId());
        OperatorSchool operatorSchool = ownedOperatorSchoolForUpdate(
                reference.getOperatorSchoolId(),
                operator.getId()
        );
        ServiceOffering offering = ownedOfferingForUpdate(id, operator.getId());
        rejectStaleReference(false, vehicle.getId(), offering.getVehicle().getId());
        rejectStaleReference(false, operatorSchool.getId(), offering.getOperatorSchool().getId());
        validatePublishableOperatorSchool(operatorSchool);
        validateAvailableSeats(offering.getAvailableSeats(), vehicle.getCapacity());
        long coverageCount = offeringCoverageRepository.countByServiceOfferingId(offering.getId());
        long validCoverageCount = offeringCoverageRepository
                .countByServiceOfferingIdAndOperatorSchoolCoverageOperatorSchoolId(
                        offering.getId(),
                        operatorSchool.getId()
                );
        if (coverageCount == 0) {
            throw OfferingApiException.conflict(
                    "offering_coverage_required",
                    "At least one valid offering coverage item is required before publication"
            );
        }
        if (coverageCount != validCoverageCount) {
            throw OfferingApiException.conflict(
                    "offering_coverage_invalid",
                    "Offering coverage must belong to the offering's operator-school relationship"
            );
        }
        offering.publish();
        offeringRepository.flush();
        return toOfferingResponse(offering, offeringCoverage(offering.getId()));
    }

    @Transactional
    public ServiceOfferingResponse unpublishOffering(UUID id) {
        OperatorProfile operator = currentOperator();
        ServiceOffering offering = ownedOfferingForUpdate(id, operator.getId());
        offering.unpublish();
        offeringRepository.flush();
        return toOfferingResponse(offering, offeringCoverage(offering.getId()));
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
                .orElseThrow(this::vehicleNotFound);
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
                .orElseThrow(this::offeringNotFound);
    }

    private OwnedReference ownedOfferingReference(UUID id, UUID operatorId) {
        return offeringRepository.findOwnedReference(id, operatorId)
                .orElseThrow(this::offeringNotFound);
    }

    private void rejectStaleReference(boolean explicitlyReplaced, UUID lockedId, UUID currentId) {
        if (!explicitlyReplaced && !lockedId.equals(currentId)) {
            throw OfferingApiException.conflict(
                    "offering_update_conflict",
                    "The offering changed while it was being updated; retry with fresh data"
            );
        }
    }

    private void deactivateVehicleAndOfferings(Vehicle vehicle) {
        vehicle.deactivate();
        offeringRepository.unpublishAllByVehicleId(vehicle.getId());
    }

    private void validatePublishableOperatorSchool(OperatorSchool operatorSchool) {
        if (!operatorSchool.isActive() || !operatorSchool.getSchool().isActive()) {
            throw OfferingApiException.conflict(
                    "operator_school_inactive",
                    "An offering requires an active operator-school relationship and school"
            );
        }
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

    private Map<UUID, List<ServiceOfferingCoverage>> coverageByOffering(
            List<ServiceOffering> offerings
    ) {
        if (offerings.isEmpty()) {
            return Map.of();
        }
        Map<UUID, List<ServiceOfferingCoverage>> coverageByOffering = new HashMap<>();
        offeringCoverageRepository.findAllDetailedByOfferingIds(
                offerings.stream().map(ServiceOffering::getId).toList()
        ).forEach(coverage -> coverageByOffering.computeIfAbsent(
                coverage.getServiceOffering().getId(),
                ignored -> new ArrayList<>()
        ).add(coverage));
        return coverageByOffering;
    }

    private List<ServiceOfferingCoverage> offeringCoverage(UUID offeringId) {
        return offeringCoverageRepository.findAllDetailedByOfferingIds(List.of(offeringId));
    }

    private ServiceOfferingResponse toOfferingResponse(
            ServiceOffering offering,
            List<ServiceOfferingCoverage> coverage
    ) {
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
                coverage.stream().map(this::toCoverageResponse).toList(),
                offering.getCreatedAt(),
                offering.getUpdatedAt()
        );
    }

    private CoverageResponse toCoverageResponse(ServiceOfferingCoverage offeringCoverage) {
        Neighborhood neighborhood = offeringCoverage.getOperatorSchoolCoverage().getNeighborhood();
        District district = neighborhood.getDistrict();
        Province province = district.getProvince();
        return new CoverageResponse(
                neighborhood.getId(),
                neighborhood.getName(),
                district.getId(),
                district.getName(),
                province.getId(),
                province.getCode(),
                province.getName()
        );
    }
}
