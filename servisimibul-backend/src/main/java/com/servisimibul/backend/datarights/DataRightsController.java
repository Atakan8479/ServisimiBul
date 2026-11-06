package com.servisimibul.backend.datarights;

import com.servisimibul.backend.datarights.DataRightsDtos.RequesterView;
import com.servisimibul.backend.datarights.DataRightsDtos.SubmitRequest;
import com.servisimibul.backend.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Requester endpoints; every lookup is scoped to the signed-in account. */
@RestController
@RequestMapping("/api/v1/data-rights-requests")
@RequiredArgsConstructor
public class DataRightsController {

    private final DataRightsService service;
    private final CurrentUser currentUser;

    @PostMapping
    public ResponseEntity<RequesterView> submit(@Valid @RequestBody SubmitRequest request) {
        var result = service.submit(request, currentUser.id());
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK)
                .body(result.request());
    }

    @GetMapping
    public List<RequesterView> list(@RequestParam(required = false) DataRightsRequestType type) {
        return service.ownRequests(currentUser.id(), type);
    }

    @GetMapping("/{requestId}")
    public RequesterView detail(@PathVariable UUID requestId) {
        return service.ownRequest(requestId, currentUser.id());
    }
}
