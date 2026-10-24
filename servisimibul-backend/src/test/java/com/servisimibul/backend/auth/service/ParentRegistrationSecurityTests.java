package com.servisimibul.backend.auth.service;

import com.servisimibul.backend.demand.DemandRepository;
import com.servisimibul.backend.geography.District;
import com.servisimibul.backend.geography.DistrictRepository;
import com.servisimibul.backend.geography.Neighborhood;
import com.servisimibul.backend.geography.NeighborhoodRepository;
import com.servisimibul.backend.geography.Province;
import com.servisimibul.backend.geography.ProvinceRepository;
import com.servisimibul.backend.geography.School;
import com.servisimibul.backend.geography.SchoolRepository;
import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import com.servisimibul.backend.identity.EmailVerificationTokenRepository;
import com.servisimibul.backend.identity.OperatorProfileRepository;
import com.servisimibul.backend.identity.UserRole;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "app.auth.parent-registration.enabled=true",
        "app.auth.parent-email-verification.required=false",
        "servisimibul.email.enabled=false",
        "app.rate-limit.registration-ip.requests=2"
})
@AutoConfigureMockMvc
@Import(ParentRegistrationSecurityTests.TestBeans.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@Transactional
class ParentRegistrationSecurityTests {

    private static final String PASSWORD = "correct horse battery staple";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private AppUserRepository userRepository;
    @Autowired
    private OperatorProfileRepository profileRepository;
    @Autowired
    private EmailVerificationTokenRepository verificationTokenRepository;
    @Autowired
    private ProvinceRepository provinceRepository;
    @Autowired
    private DistrictRepository districtRepository;
    @Autowired
    private NeighborhoodRepository neighborhoodRepository;
    @Autowired
    private SchoolRepository schoolRepository;
    @Autowired
    private DemandRepository demandRepository;
    @Autowired
    private RejectingAuthEmailSender emailSender;

    @BeforeEach
    void clearEmail() {
        emailSender.clear();
    }

    @Test
    void unverifiedParentRegistersLogsInAndCreatesDemandWithoutEmail() throws Exception {
        postJson(
                "/api/v1/auth/parent/register",
                """
                        {
                          "email":"  Parent@Example.COM ",
                          "password":"correct horse battery staple",
                          "role":"ADMIN",
                          "businessName":"Ignored",
                          "contactPhone":"+905321234567"
                        }
                        """,
                "10.10.0.1"
        ).andExpect(status().isAccepted());

        AppUser parent = userRepository.findByEmail("parent@example.com").orElseThrow();
        assertThat(parent.getRole()).isEqualTo(UserRole.PARENT);
        assertThat(parent.isEmailVerified()).isFalse();
        assertThat(profileRepository.findByUserId(parent.getId())).isEmpty();
        assertThat(verificationTokenRepository.count()).isZero();
        assertThat(emailSender.verificationCalls()).isZero();

        LoginSession login = login(parent.getEmail(), "10.10.1.1");

        mockMvc.perform(get("/api/v1/auth/me").cookie(login.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(parent.getEmail()))
                .andExpect(jsonPath("$.role").value("PARENT"));

        Geography geography = geography();
        mockMvc.perform(post("/api/v1/demands")
                        .cookie(login.cookie())
                        .header(login.csrfHeader(), login.csrfToken())
                        .contentType("application/json")
                        .content("""
                                {
                                  "schoolId":"%s",
                                  "neighborhoodId":%d,
                                  "needsMorning":true,
                                  "needsAfternoon":false,
                                  "reasons":["NO_SUITABLE_SERVICE"]
                                }
                                """.formatted(geography.schoolId(), geography.neighborhoodId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.demand.supporterCount").value(1));
        assertThat(demandRepository.count()).isOne();

        mockMvc.perform(get("/api/v1/operator/profile").cookie(login.cookie()))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/admin/schools").cookie(login.cookie()))
                .andExpect(status().isForbidden());
    }

    @Test
    void duplicateRegistrationReturnsTheSameResponseWithoutEmailOrToken() throws Exception {
        register("duplicate-parent@example.com", "10.10.0.2")
                .andExpect(status().isAccepted());
        register("DUPLICATE-PARENT@example.com", "10.10.0.2")
                .andExpect(status().isAccepted());

        assertThat(userRepository.findAll().stream()
                .filter(user -> user.getEmail().equals("duplicate-parent@example.com")))
                .hasSize(1);
        assertThat(verificationTokenRepository.count()).isZero();
        assertThat(emailSender.verificationCalls()).isZero();
    }

    @Test
    void registrationRequiresCsrfAndValidCredentials() throws Exception {
        mockMvc.perform(post("/api/v1/auth/parent/register")
                        .contentType("application/json")
                        .content(parentJson("csrf-parent@example.com", PASSWORD)))
                .andExpect(status().isForbidden());

        postJson(
                "/api/v1/auth/parent/register",
                parentJson("weak-parent@example.com", "too-short"),
                "10.10.0.3"
        ).andExpect(status().isBadRequest());
        assertThat(userRepository.findByEmail("weak-parent@example.com")).isEmpty();
    }

    @Test
    void registrationUsesTheExistingIpRateLimit() throws Exception {
        register("limited-parent-1@example.com", "10.10.0.4")
                .andExpect(status().isAccepted());
        register("limited-parent-2@example.com", "10.10.0.4")
                .andExpect(status().isAccepted());
        register("limited-parent-3@example.com", "10.10.0.4")
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
    }

    @Test
    void disabledParentCannotAuthenticate() throws Exception {
        register("disabled-parent@example.com", "10.10.0.5")
                .andExpect(status().isAccepted());
        AppUser parent = userRepository.findByEmail("disabled-parent@example.com").orElseThrow();
        parent.disable();
        userRepository.saveAndFlush(parent);

        postJson("/api/v1/auth/login", loginJson(parent.getEmail()), "10.10.1.5")
                .andExpect(status().isUnauthorized());
    }

    private org.springframework.test.web.servlet.ResultActions register(
            String email,
            String remoteAddress
    ) throws Exception {
        return postJson(
                "/api/v1/auth/parent/register",
                parentJson(email, PASSWORD),
                remoteAddress
        );
    }

    private String parentJson(String email, String password) {
        return "{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password);
    }

    private String loginJson(String email) {
        return "{\"email\":\"%s\",\"password\":\"%s\",\"rememberMe\":false}"
                .formatted(email, PASSWORD);
    }

    private LoginSession login(String email, String remoteAddress) throws Exception {
        MvcResult csrfResult = mockMvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk())
                .andReturn();
        CsrfToken csrf = (CsrfToken) csrfResult.getRequest()
                .getAttribute(CsrfToken.class.getName());
        Cookie csrfCookie = csrfResult.getResponse().getCookie("SBSESSION");
        assertThat(csrfCookie).isNotNull();

        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .cookie(csrfCookie)
                        .header(csrf.getHeaderName(), csrf.getToken())
                        .with(request -> {
                            request.setRemoteAddr(remoteAddress);
                            return request;
                        })
                        .contentType("application/json")
                        .content(loginJson(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("PARENT"))
                .andReturn();
        Cookie sessionCookie = loginResult.getResponse().getCookie("SBSESSION");
        assertThat(sessionCookie).isNotNull();
        return new LoginSession(sessionCookie, csrf.getHeaderName(), csrf.getToken());
    }

    private org.springframework.test.web.servlet.ResultActions postJson(
            String path,
            String json,
            String remoteAddress
    ) throws Exception {
        return mockMvc.perform(post(path)
                .with(csrf())
                .with(request -> {
                    request.setRemoteAddr(remoteAddress);
                    return request;
                })
                .contentType("application/json")
                .content(json));
    }

    private Geography geography() {
        Province province = provinceRepository.save(new Province("34", "Istanbul"));
        District schoolDistrict = districtRepository.save(new District(province, "Kadikoy"));
        District pickupDistrict = districtRepository.save(new District(province, "Uskudar"));
        Neighborhood schoolNeighborhood = neighborhoodRepository.save(
                new Neighborhood(schoolDistrict, "Caferaga")
        );
        Neighborhood pickup = neighborhoodRepository.saveAndFlush(
                new Neighborhood(pickupDistrict, "Acibadem")
        );
        School school = schoolRepository.saveAndFlush(
                new School(schoolNeighborhood, "Parent Registration School", null, null, null)
        );
        return new Geography(school.getId(), pickup.getId());
    }

    private record Geography(java.util.UUID schoolId, Long neighborhoodId) {
    }

    private record LoginSession(Cookie cookie, String csrfHeader, String csrfToken) {
    }

    static final class RejectingAuthEmailSender implements AuthEmailSender {

        private final AtomicInteger verificationCalls = new AtomicInteger();

        @Override
        public boolean isAvailable() {
            return false;
        }

        @Override
        public void sendVerification(String email, String rawToken) {
            verificationCalls.incrementAndGet();
        }

        @Override
        public void sendPasswordReset(String email, String rawToken) {
        }

        int verificationCalls() {
            return verificationCalls.get();
        }

        void clear() {
            verificationCalls.set(0);
        }
    }

    @TestConfiguration
    static class TestBeans {

        @Bean
        @Primary
        RejectingAuthEmailSender rejectingAuthEmailSender() {
            return new RejectingAuthEmailSender();
        }
    }
}
