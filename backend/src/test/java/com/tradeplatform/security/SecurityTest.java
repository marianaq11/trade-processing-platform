package com.tradeplatform.security;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestBuilders.formLogin;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.jayway.jsonpath.JsonPath;
import com.tradeplatform.IntegrationTest;

class SecurityTest extends IntegrationTest {

    private static final RequestPostProcessor TRADER_1 = user("trader1").roles("TRADER");
    private static final RequestPostProcessor TRADER_2 = user("trader2").roles("TRADER");
    private static final RequestPostProcessor RISK_USER = user("risk1").roles("RISK_MANAGER");

    private static final String TRADE_JSON = """
            {"clientTradeId": "%s", "accountCode": "ACC-1001", "symbol": "AAPL",
             "side": "BUY", "quantity": 10, "price": 230.00}
            """;

    private long submitAs(RequestPostProcessor trader) throws Exception {
        String json = mockMvc.perform(post("/api/trades").with(trader).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(TRADE_JSON.formatted(UUID.randomUUID())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(json, "$.id")).longValue();
    }

    @Test
    void apiRequiresLogin() throws Exception {
        mockMvc.perform(get("/api/trades")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void healthCheckIsPublic() throws Exception {
        mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }

    @Test
    void loginWithSeededUserStartsASession() throws Exception {
        MockHttpSession session = (MockHttpSession) mockMvc
                .perform(formLogin("/api/auth/login").user("trader1").password("demo-pass"))
                .andExpect(status().isNoContent())
                .andReturn().getRequest().getSession();

        mockMvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("trader1"))
                .andExpect(jsonPath("$.role").value("TRADER"));
    }

    @Test
    void wrongPasswordIsRejected() throws Exception {
        mockMvc.perform(formLogin("/api/auth/login").user("trader1").password("wrong"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void postWithoutCsrfTokenIsForbidden() throws Exception {
        mockMvc.perform(post("/api/trades").with(TRADER_1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(TRADE_JSON.formatted(UUID.randomUUID())))
                .andExpect(status().isForbidden());
    }

    @Test
    void onlyTradersCanSubmit() throws Exception {
        mockMvc.perform(post("/api/trades").with(OPS_USER).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(TRADE_JSON.formatted(UUID.randomUUID())))
                .andExpect(status().isForbidden());
    }

    @Test
    void onlyOperationsCanCancel() throws Exception {
        long id = submitAs(TRADER_1);

        mockMvc.perform(post("/api/trades/{id}/cancel", id).with(TRADER_1).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"changed my mind\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/trades/{id}/cancel", id).with(RISK_USER).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"changed my mind\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void cancelRecordsWhoDidIt() throws Exception {
        long id = submitAs(TRADER_1);

        mockMvc.perform(post("/api/trades/{id}/cancel", id).with(OPS_USER).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"client request\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/trades/{id}/events", id).with(OPS_USER))
                .andExpect(jsonPath("$[3].performedBy").value("ops1"));
    }

    @Test
    void tradersOnlySeeTheirOwnTrades() throws Exception {
        long mine = submitAs(TRADER_1);
        long theirs = submitAs(TRADER_2);

        mockMvc.perform(get("/api/trades").with(TRADER_1))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(mine));
        mockMvc.perform(get("/api/trades/{id}", theirs).with(TRADER_1))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/trades/{id}/events", theirs).with(TRADER_1))
                .andExpect(status().isNotFound());
    }

    @Test
    void operationsAndRiskSeeAllTrades() throws Exception {
        submitAs(TRADER_1);
        submitAs(TRADER_2);

        mockMvc.perform(get("/api/trades").with(OPS_USER))
                .andExpect(jsonPath("$.totalElements").value(2));
        mockMvc.perform(get("/api/trades").with(RISK_USER))
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void reusingAnotherTradersClientTradeIdIsAConflict() throws Exception {
        String body = TRADE_JSON.formatted("shared-id");
        mockMvc.perform(post("/api/trades").with(TRADER_1).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());

        // Same account, same details, but a different user: must not get trader1's trade back.
        mockMvc.perform(post("/api/trades").with(TRADER_2).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict());
    }
}
