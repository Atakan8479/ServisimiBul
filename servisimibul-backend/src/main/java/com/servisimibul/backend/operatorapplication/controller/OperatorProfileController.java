package com.servisimibul.backend.operatorapplication.controller;

import com.servisimibul.backend.operatorapplication.dto.OperatorApplicationDtos.DiscoveryReadinessResponse;
import com.servisimibul.backend.operatorapplication.dto.OperatorApplicationDtos.ProfilePatchRequest;
import com.servisimibul.backend.operatorapplication.dto.OperatorApplicationDtos.ProfileResponse;
import com.servisimibul.backend.operatorapplication.service.OperatorApplicationService;
import com.servisimibul.backend.operatorapplication.service.OperatorDiscoveryReadinessService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/operator")
@RequiredArgsConstructor
public class OperatorProfileController {

    private final OperatorApplicationService operatorApplicationService;
    private final OperatorDiscoveryReadinessService discoveryReadinessService;

    @GetMapping("/profile")
    public ProfileResponse profile() {
        return operatorApplicationService.profile();
    }

    @GetMapping("/discovery-readiness")
    public DiscoveryReadinessResponse discoveryReadiness() {
        return discoveryReadinessService.readiness();
    }

    @PatchMapping("/profile")
    public ProfileResponse patchProfile(@Valid @RequestBody ProfilePatchRequest request) {
        return operatorApplicationService.patchProfile(request);
    }

    @PostMapping("/application/submit")
    public ProfileResponse submit() {
        return operatorApplicationService.submit();
    }

    @PostMapping("/application/resubmit")
    public ProfileResponse resubmit() {
        return operatorApplicationService.resubmit();
    }
}
