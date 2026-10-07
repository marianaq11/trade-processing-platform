package com.tradeplatform.trade;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.tradeplatform.IntegrationTest;

// Edge cases found while poking at the API with curl. Each of these used to either change
// the trade silently or end in a 500.
class TradeInputTest extends IntegrationTest {

    private static final RequestPostProcessor TRADER = user("trader1").roles("TRADER");

    private ResultActions submitRaw(String json) throws Exception {
        return mockMvc.perform(post("/api/trades").with(TRADER).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json));
    }

    private int tradeCount() {
        return jdbcTemplate.queryForObject("SELECT count(*) FROM trade", Integer.class);
    }

    @Test
    void fractionalQuantityIsRejectedInsteadOfTruncated() throws Exception {
        // Jackson's default would turn 1.5 into 1 and book a trade for a different quantity.
        submitRaw("""
                {"clientTradeId": "frac", "accountCode": "ACC-1001", "symbol": "AAPL",
                 "side": "BUY", "quantity": 1.5, "price": 230}
                """)
                .andExpect(status().isBadRequest());

        assertThat(tradeCount()).isZero();
    }

    @Test
    void priceAboveTheCapIsAFieldError() throws Exception {
        submitRaw("""
                {"clientTradeId": "big-price", "accountCode": "ACC-1001", "symbol": "AAPL",
                 "side": "BUY", "quantity": 1, "price": 999999999999999}
                """)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.price").exists());
    }

    @Test
    void largestAllowedTradeStillFitsTheNotionalColumn() throws Exception {
        // max price x max quantity used to overflow NUMERIC(19,4) and come back as a 500
        submitRaw("""
                {"clientTradeId": "max", "accountCode": "ACC-1001", "symbol": "AAPL",
                 "side": "BUY", "quantity": 10000000, "price": 9999999.9999}
                """)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("REJECTED"));
    }

    @Test
    void oversizedCodesAreFieldErrorsAndAreNotEchoedBack() throws Exception {
        String longCode = "A".repeat(5000);
        submitRaw("""
                {"clientTradeId": "long", "accountCode": "%s", "symbol": "%s",
                 "side": "BUY", "quantity": 1, "price": 230}
                """.formatted(longCode, longCode))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.accountCode").exists())
                .andExpect(jsonPath("$.errors.symbol").exists())
                .andExpect(jsonPath("$.detail").value("Request has invalid fields"));
    }

    @Test
    void absurdPageNumbersAreABadRequest() throws Exception {
        mockMvc.perform(get("/api/trades").param("page", "50000000").param("size", "100").with(OPS_USER))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.page").exists());
        mockMvc.perform(get("/api/risk-limit-changes").param("page", "50000000").with(RISK_USER))
                .andExpect(status().isBadRequest());
    }
}
