package com.servisimibul.backend.auth.dto;

public record CsrfResponse(String headerName, String parameterName, String token) {
}
