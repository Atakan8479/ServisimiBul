package com.servisimibul.backend.datarights;

import com.servisimibul.backend.datarights.DataRightsDtos.RequesterView;
import com.servisimibul.backend.datarights.DataRightsDtos.SubmitRequest;
import com.servisimibul.backend.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
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
    @ResponseStatus(HttpStatus.CREATED)
    public RequesterView submit(@Valid @RequestBody SubmitRequest request) {
        return service.submit(request, currentUser.id());
    }

    @GetMapping
    public List<RequesterView> list() {
        return service.ownRequests(currentUser.id());
    }

    @GetMapping("/{requestId}")
    public RequesterView detail(@PathVariable UUID requestId) {
        return service.ownRequest(requestId, currentUser.id());
    }
}
