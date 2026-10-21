package com.servisimibul.backend.security;

import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class CsrfRegressionTests {

    private static final UUID MISSING_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    @Autowired
    private MockMvc mockMvc;

    @TestFactory
    Stream<DynamicTest> everyStateChangingEndpointFamilyRejectsMissingAndInvalidCsrf() {
        return cases().stream().flatMap(testCase -> Stream.of(
                DynamicTest.dynamicTest(testCase.name() + " missing", () ->
                        assertCsrfRejected(testCase.request().get())),
                DynamicTest.dynamicTest(testCase.name() + " invalid", () ->
                        assertCsrfRejected(testCase.request().get().with(csrf().useInvalidToken())))
        ));
    }

    @TestFactory
    Stream<DynamicTest> everyStateChangingEndpointFamilyAcceptsAValidCsrfToken() {
        return cases().stream().map(testCase -> DynamicTest.dynamicTest(testCase.name(), () -> {
            var result = mockMvc.perform(testCase.request().get().with(csrf())).andReturn();
            assertThat(result.getResponse().getStatus())
                    .as("valid CSRF must reach application handling for %s", testCase.name())
                    .isNotEqualTo(403);
        }));
    }

    private void assertCsrfRejected(MockHttpServletRequestBuilder request) throws Exception {
        mockMvc.perform(request)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
    }

    private List<CsrfCase> cases() {
        RequestPostProcessor operator = user(new AuthenticatedUser(
                MISSING_ID,
                "operator@example.com",
                "hash",
                com.servisimibul.backend.identity.UserRole.OPERATOR,
                true
        ));
        RequestPostProcessor admin = user(new AuthenticatedUser(
                MISSING_ID,
                "admin@example.com",
                "hash",
                com.servisimibul.backend.identity.UserRole.ADMIN,
                true
        ));
        RequestPostProcessor parent = user(new AuthenticatedUser(
                MISSING_ID,
                "parent@example.com",
                "hash",
                com.servisimibul.backend.identity.UserRole.PARENT,
                true
        ));
        return List.of(
                new CsrfCase("authentication", () -> json(post("/api/v1/auth/register"), "{}")),
                new CsrfCase("email verification", () ->
                        json(post("/api/v1/auth/verify-email"), "{}")),
                new CsrfCase("verification resend", () ->
                        json(post("/api/v1/auth/resend-verification"), "{}")),
                new CsrfCase("password recovery", () ->
                        json(post("/api/v1/auth/forgot-password"), "{}")),
                new CsrfCase("password reset", () ->
                        json(post("/api/v1/auth/reset-password"), "{}")),
                new CsrfCase("login", () -> json(post("/api/v1/auth/login"), "{}")),
                new CsrfCase("logout", () -> post("/api/v1/auth/logout").with(operator)),
                new CsrfCase("operator profile", () ->
                        json(patch("/api/v1/operator/profile").with(operator), "{}")),
                new CsrfCase("operator application", () ->
                        post("/api/v1/operator/application/submit").with(operator)),
                new CsrfCase("operator school", () ->
                        json(post("/api/v1/operator/schools").with(operator), "{}")),
                new CsrfCase("operator coverage", () -> json(
                        put("/api/v1/operator/schools/{id}/coverage", MISSING_ID).with(operator),
                        "{\"neighborhoodIds\":[]}"
                )),
                new CsrfCase("vehicle", () ->
                        json(post("/api/v1/operator/vehicles").with(operator), "{}")),
                new CsrfCase("offering", () ->
                        json(post("/api/v1/operator/offerings").with(operator), "{}")),
                new CsrfCase("demand comment create", () -> json(
                        post("/api/v1/demands/{id}/comments", MISSING_ID).with(parent),
                        "{\"body\":\"yorum\"}"
                )),
                new CsrfCase("demand comment delete", () -> delete(
                        "/api/v1/demands/{demandId}/comments/{commentId}",
                        MISSING_ID,
                        MISSING_ID
                ).with(parent)),
                new CsrfCase("admin operator", () ->
                        post("/api/v1/admin/operators/{id}/approve", MISSING_ID).with(admin)),
                new CsrfCase("admin school", () ->
                        json(post("/api/v1/admin/schools").with(admin), "{}")),
                new CsrfCase("tariff", () -> json(
                        put("/api/v1/admin/tariffs/34").with(admin),
                        "{}"
                ))
        );
    }

    private MockHttpServletRequestBuilder json(
            MockHttpServletRequestBuilder request,
            String body
    ) {
        return request.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private record CsrfCase(
            String name,
            Supplier<MockHttpServletRequestBuilder> request
    ) {
    }
}
