package com.servisimibul.backend.demand.comment.controller;

import com.servisimibul.backend.demand.comment.dto.DemandCommentDtos.CommentResponse;
import com.servisimibul.backend.demand.comment.dto.DemandCommentDtos.CreateRequest;
import com.servisimibul.backend.demand.comment.dto.DemandCommentDtos.PageResponse;
import com.servisimibul.backend.demand.comment.service.DemandCommentService;
import com.servisimibul.backend.security.AuthenticatedUser;
import com.servisimibul.backend.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/demands/{demandId}/comments")
@RequiredArgsConstructor
public class DemandCommentController {

    private final DemandCommentService commentService;
    private final CurrentUser currentUser;

    @GetMapping
    public PageResponse<CommentResponse> list(
            @PathVariable UUID demandId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        return commentService.list(demandId, page, size, user == null ? null : user.id());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CommentResponse create(
            @PathVariable UUID demandId,
            @Valid @RequestBody CreateRequest request
    ) {
        return commentService.create(demandId, request, currentUser.id());
    }

    @DeleteMapping("/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable UUID demandId,
            @PathVariable UUID commentId
    ) {
        commentService.delete(demandId, commentId, currentUser.id());
    }
}
