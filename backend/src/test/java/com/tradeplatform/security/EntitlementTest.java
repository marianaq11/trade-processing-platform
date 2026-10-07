package com.tradeplatform.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.jayway.jsonpath.JsonPath;
import com.tradeplatform.IntegrationTest;

// Demo entitlements: trader1 -> ACC-1001, ACC-1002, ACC-1004; trader2 -> ACC-1002, ACC-1003, ACC-1004.
class EntitlementTest extends IntegrationTest {

    private static final RequestPostProcessor TRADER_1 = user("trader1").roles("TRADER");
    private static final RequestPostProcessor TRADER_2 = user("trader2").roles("TRADER");

    private ResultActions submit(RequestPostProcessor trader, String clientTradeId, String account) throws Exception {
        return submitJson(trader, """
                {"clientTradeId": "%s", "accountCode": "%s", "symbol": "AAPL",
                 "side": "BUY", "quantity": 100, "price": 230.00}
                """.formatted(clientTradeId, account));
    }

    private ResultActions submitJson(RequestPostProcessor trader, String json) throws Exception {
        return mockMvc.perform(post("/api/trades").with(trader).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json));
    }

    private int tradeCount() {
        return jdbcTemplate.queryForObject("SELECT count(*) FROM trade", Integer.class);
    }

    @Test
    void traderCanTradeOnTheirOwnAccounts() throws Exception {
        submit(TRADER_1, "a", "ACC-1001").andExpect(status().isCreated());
        submit(TRADER_1, "b", "ACC-1002").andExpect(status().isCreated());
        submit(TRADER_2, "c", "ACC-1003").andExpect(status().isCreated());
    }

    @Test
    void traderCannotTradeOnSomeoneElsesAccount() throws Exception {
        submit(TRADER_1, "x", "ACC-1003")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("You aren't entitled to trade on account ACC-1003"));
        submit(TRADER_2, "y", "ACC-1001").andExpect(status().isForbidden());

        // not even stored as a rejected trade: the trader had no business booking it at all
        assertThat(tradeCount()).isZero();
    }

    @Test
    void unknownAccountLooksExactlyLikeAForbiddenOne() throws Exception {
        // If these differed, a trader could probe which account codes exist.
        String forbidden = submit(TRADER_1, "x", "ACC-1003").andReturn().getResponse().getContentAsString();
        String unknown = submit(TRADER_1, "y", "ACC-9999").andExpect(status().isForbidden())
                .andReturn().getResponse().getContentAsString();

        assertThat(unknown.replace("ACC-9999", "ACC-XXXX")).isEqualTo(forbidden.replace("ACC-1003", "ACC-XXXX"));
    }

    @Test
    void variationsOfAnAccountCodeDontSlipThrough() throws Exception {
        for (String code : new String[] {"acc-1003", " ACC-1003", "ACC-1003 ", "ACC-1003%"}) {
            submit(TRADER_1, "v" + code.hashCode(), code).andExpect(status().isForbidden());
        }
        assertThat(tradeCount()).isZero();
    }

    @Test
    void tradersOnlyGetTheirOwnAccountsInTheList() throws Exception {
        mockMvc.perform(get("/api/accounts").with(TRADER_1))
                .andExpect(jsonPath("$[*].code", Matchers.contains("ACC-1001", "ACC-1002", "ACC-1004")));
        mockMvc.perform(get("/api/accounts").with(TRADER_2))
                .andExpect(jsonPath("$[*].code", Matchers.contains("ACC-1002", "ACC-1003", "ACC-1004")))
                .andExpect(content().string(not(containsString("Harbor Growth Fund"))));
    }

    @Test
    void operationsAndRiskStillSeeEveryAccount() throws Exception {
        mockMvc.perform(get("/api/accounts").with(OPS_USER)).andExpect(jsonPath("$.length()").value(4));
        mockMvc.perform(get("/api/accounts").with(RISK_USER)).andExpect(jsonPath("$.length()").value(4));
    }

    @Test
    void anotherTradersClientTradeIdOnAnAccountYouCantUseIsForbiddenNotAConflict() throws Exception {
        submit(TRADER_1, "shared-id", "ACC-1001").andExpect(status().isCreated());

        // Identical payload from trader2, who can't use ACC-1001. A 409 or 200 here would tell
        // them the trade exists (or hand it over); the entitlement check runs first instead.
        submit(TRADER_2, "shared-id", "ACC-1001")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.id").doesNotExist());
    }

    @Test
    void retryingAfterAnEntitlementIsRemovedIsForbidden() throws Exception {
        String json = submit(TRADER_1, "retry-me", "ACC-1002").andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = ((Number) JsonPath.read(json, "$.id")).longValue();

        jdbcTemplate.update("""
                DELETE FROM account_entitlement
                WHERE user_id = (SELECT id FROM app_user WHERE username = 'trader1')
                  AND account_id = (SELECT id FROM account WHERE code = 'ACC-1002')
                """);

        // a resubmit of an existing trade doesn't get around the check
        submit(TRADER_1, "retry-me", "ACC-1002").andExpect(status().isForbidden());
        submit(TRADER_1, "new-one", "ACC-1002").andExpect(status().isForbidden());

        // they can still look at trades they booked before
        mockMvc.perform(get("/api/trades/{id}", id).with(TRADER_1)).andExpect(status().isOk());
    }

    @Test
    void extraFieldsInTheRequestAreIgnored() throws Exception {
        // Someone editing the request by hand can't set who submitted it, its status or its notional.
        submitJson(TRADER_1, """
                {"clientTradeId": "tampered", "accountCode": "ACC-1001", "symbol": "AAPL",
                 "side": "BUY", "quantity": 100, "price": 230.00,
                 "id": 999, "submittedBy": "trader2", "status": "SETTLED", "notional": 1,
                 "tradeDate": "2020-01-01", "settlementDate": "2020-01-02"}
                """)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(Matchers.not(999)))
                .andExpect(jsonPath("$.submittedBy").value("trader1"))
                .andExpect(jsonPath("$.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.notional").value(23000.0))
                .andExpect(jsonPath("$.tradeDate").value("2026-10-05"))
                .andExpect(jsonPath("$.settlementDate").value("2026-10-06"));
    }
}
