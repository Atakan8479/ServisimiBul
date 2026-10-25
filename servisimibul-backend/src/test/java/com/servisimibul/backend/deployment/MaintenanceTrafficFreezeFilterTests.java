package com.servisimibul.backend.deployment;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class MaintenanceTrafficFreezeFilterTests {
    @Test
    void frozenModeRejectsApplicationWritesAndReads() throws Exception {
        var filter = new MaintenanceTrafficFreezeFilter(true);
        for (String method : new String[]{"GET","POST","PUT","DELETE"}) {
            var request = new MockHttpServletRequest(method, "/api/v1/demands");
            var response = new MockHttpServletResponse();
            FilterChain chain = mock(FilterChain.class);
            filter.doFilter(request, response, chain);
            assertThat(response.getStatus()).isEqualTo(503);
            assertThat(response.getContentAsString()).contains("SERVICE_MAINTENANCE");
            verifyNoInteractions(chain);
        }
    }
    @Test
    void livenessRemainsAvailableButReadinessDoesNot() throws Exception {
        var filter = new MaintenanceTrafficFreezeFilter(true);
        var live = new MockHttpServletRequest("GET","/livez");
        var response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);
        filter.doFilter(live, response, chain);
        verify(chain).doFilter(live,response);
        var ready = new MockHttpServletRequest("GET","/readyz");
        var blocked = new MockHttpServletResponse();
        filter.doFilter(ready,blocked,chain);
        assertThat(blocked.getStatus()).isEqualTo(503);
    }
    @Test
    void normalModeAllowsRequests() throws Exception {
        var filter = new MaintenanceTrafficFreezeFilter(false);
        var request = new MockHttpServletRequest("POST","/api/v1/demands");
        var response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);
        filter.doFilter(request,response,chain);
        verify(chain).doFilter(request,response);
    }
}
