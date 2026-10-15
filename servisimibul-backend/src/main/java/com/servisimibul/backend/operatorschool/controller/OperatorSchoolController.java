package com.servisimibul.backend.operatorschool.controller;

import com.servisimibul.backend.operatorschool.dto.OperatorSchoolDtos.CoverageReplaceRequest;
import com.servisimibul.backend.operatorschool.dto.OperatorSchoolDtos.CreateRequest;
import com.servisimibul.backend.operatorschool.dto.OperatorSchoolDtos.OperatorSchoolResponse;
import com.servisimibul.backend.operatorschool.dto.OperatorSchoolDtos.PatchRequest;
import com.servisimibul.backend.operatorschool.service.OperatorSchoolService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/operator/schools")
@RequiredArgsConstructor
public class OperatorSchoolController {

    private final OperatorSchoolService operatorSchoolService;

    @GetMapping
    public List<OperatorSchoolResponse> list() {
        return operatorSchoolService.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OperatorSchoolResponse create(@Valid @RequestBody CreateRequest request) {
        return operatorSchoolService.create(request);
    }

    @PatchMapping("/{id}")
    public OperatorSchoolResponse patch(
            @PathVariable UUID id,
            @Valid @RequestBody PatchRequest request
    ) {
        return operatorSchoolService.patch(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        operatorSchoolService.delete(id);
    }

    @PutMapping("/{id}/coverage")
    public OperatorSchoolResponse replaceCoverage(
            @PathVariable UUID id,
            @Valid @RequestBody CoverageReplaceRequest request
    ) {
        return operatorSchoolService.replaceCoverage(id, request);
    }
}
