package com.servisimibul.backend.security;

import jakarta.servlet.DispatcherType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextHolderFilter;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;
import org.springframework.security.web.header.writers.StaticHeadersWriter;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

import java.time.Clock;
import java.util.List;

@Configuration
public class SecurityConfiguration {

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    CookieSerializer sessionCookieSerializer(
            Clock clock,
            @Value("${server.servlet.session.cookie.secure:true}") boolean secure
    ) {
        DefaultCookieSerializer delegate = new DefaultCookieSerializer();
        delegate.setCookieName("SBSESSION");
        delegate.setCookiePath("/");
        delegate.setUseHttpOnlyCookie(true);
        delegate.setUseSecureCookie(secure);
        delegate.setSameSite("Lax");
        return new RememberMeCookieSerializer(delegate, clock);
    }

    @Bean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            SecurityContextRepository securityContextRepository,
            Clock clock,
            RestSecurityErrorHandler securityErrorHandler
    ) throws Exception {
        SessionLifetimeFilter sessionLifetimeFilter = new SessionLifetimeFilter(clock);
        http
                .securityContext(context -> context
                        .securityContextRepository(securityContextRepository)
                        .requireExplicitSave(true)
                )
                .authorizeHttpRequests(authorize -> authorize
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers(HttpMethod.GET,
                                "/livez",
                                "/readyz",
                                "/actuator/health",
                                "/actuator/health/liveness",
                                "/actuator/health/readiness"
                        ).permitAll()
                        .requestMatchers(HttpMethod.GET,
                                "/api/v1/provinces",
                                "/api/v1/districts",
                                "/api/v1/neighborhoods",
                                "/api/v1/schools",
                                "/api/v1/schools/*",
                                "/api/v1/demands",
                                "/api/v1/demands/*",
                                "/api/v1/demands/*/comments",
                                "/api/v1/demands/*/responses",
                                "/api/v1/operators",
                                "/api/v1/operators/*",
                                "/api/v1/tariffs",
                                "/api/v1/auth/csrf"
                        ).permitAll()
                        .requestMatchers(HttpMethod.POST,
                                "/api/v1/auth/register",
                                "/api/v1/auth/verify-email",
                                "/api/v1/auth/resend-verification",
                                "/api/v1/auth/forgot-password",
                                "/api/v1/auth/reset-password",
                                "/api/v1/auth/login"
                        ).permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/auth/me").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/logout").authenticated()
                        .requestMatchers(HttpMethod.POST,
                                "/api/v1/demands",
                                "/api/v1/demands/*/support",
                                "/api/v1/demands/*/feedback/open"
                        ).hasRole("PARENT")
                        .requestMatchers(HttpMethod.GET, "/api/v1/demands/*/feedback").hasRole("PARENT")
                        .requestMatchers(HttpMethod.PUT,
                                "/api/v1/demands/*/support",
                                "/api/v1/demands/*/feedback/*"
                        ).hasRole("PARENT")
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/demands/*/support").hasRole("PARENT")
                        .requestMatchers(HttpMethod.POST, "/api/v1/demands/*/comments")
                        .hasAnyRole("PARENT", "OPERATOR")
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/demands/*/comments/*")
                        .hasAnyRole("PARENT", "OPERATOR")
                        .requestMatchers("/api/v1/operator/**").hasRole("OPERATOR")
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                        .anyRequest().denyAll()
                )
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(securityErrorHandler)
                        .accessDeniedHandler(securityErrorHandler)
                )
                .headers(headers -> {
                    headers.frameOptions(frame -> frame.deny());
                    headers.referrerPolicy(referrer -> referrer
                            .policy(ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN));
                    headers.addHeaderWriter(new StaticHeadersWriter(
                            "Permissions-Policy",
                            "camera=(), geolocation=(), microphone=()"
                    ));
                    headers.httpStrictTransportSecurity(hsts -> hsts
                            .includeSubDomains(true)
                            .maxAgeInSeconds(31_536_000));
                })
                .addFilterAfter(sessionLifetimeFilter, SecurityContextHolderFilter.class)
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable());

        return http.build();
    }

    private record RememberMeCookieSerializer(DefaultCookieSerializer delegate, Clock clock)
            implements CookieSerializer {

        @Override
        public void writeCookieValue(CookieValue cookieValue) {
            Object value = cookieValue.getRequest().getAttribute(SessionLifetimeFilter.REMEMBER_UNTIL_ATTRIBUTE);
            if (cookieValue.getCookieMaxAge() < 0 && value instanceof Long rememberUntil) {
                long remainingSeconds = Math.max(0, (rememberUntil - clock.millis() + 999) / 1_000);
                cookieValue.setCookieMaxAge(Math.toIntExact(remainingSeconds));
            }
            delegate.writeCookieValue(cookieValue);
        }

        @Override
        public List<String> readCookieValues(jakarta.servlet.http.HttpServletRequest request) {
            return delegate.readCookieValues(request);
        }
    }
}
