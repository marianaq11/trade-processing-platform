package com.tradeplatform.trade;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.tradeplatform.IntegrationTest;

// Sorting, filters and status counts used by the trades page.
class TradeQueryTest extends IntegrationTest {

    private static final RequestPostProcessor TRADER_1 = user("trader1").roles("TRADER");
    private static final RequestPostProcessor TRADER_2 = user("trader2").roles("TRADER");

    private void submit(RequestPostProcessor trader, String account, String side, long quantity, String price)
            throws Exception {
        String body = """
                {"clientTradeId": "%s", "accountCode": "%s", "symbol": "AAPL",
                 "side": "%s", "quantity": %d, "price": %s}
                """.formatted(UUID.randomUUID(), account, side, quantity, price);
        mockMvc.perform(post("/api/trades").with(trader).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());
    }

    @Test
    void canSortByNotional() throws Exception {
        submit(TRADER_1, "ACC-1001", "BUY", 200, "230");
        submit(TRADER_1, "ACC-1001", "BUY", 50, "230");
        submit(TRADER_1, "ACC-1001", "BUY", 100, "230");

        mockMvc.perform(get("/api/trades").param("sort", "notional").param("direction", "asc").with(OPS_USER))
                .andExpect(jsonPath("$.content[*].quantity", contains(50, 100, 200)));
        mockMvc.perform(get("/api/trades").param("sort", "notional").with(OPS_USER))
                .andExpect(jsonPath("$.content[*].quantity", contains(200, 100, 50)));
    }

    @Test
    void canSortBySettlementDate() throws Exception {
        clock.setDate(MONDAY.plusDays(2));
        submit(TRADER_1, "ACC-1001", "BUY", 3, "230");
        clock.setDate(MONDAY);
        submit(TRADER_1, "ACC-1001", "BUY", 1, "230");
        clock.setDate(MONDAY.plusDays(1));
        submit(TRADER_1, "ACC-1001", "BUY", 2, "230");

        mockMvc.perform(get("/api/trades").param("sort", "settlementDate").param("direction", "asc")
                        .with(OPS_USER))
                .andExpect(jsonPath("$.content[*].quantity", contains(1, 2, 3)));
    }

    @Test
    void unknownSortOrDirectionIsABadRequest() throws Exception {
        mockMvc.perform(get("/api/trades").param("sort", "account.name").with(OPS_USER))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.sort").exists());
        mockMvc.perform(get("/api/trades").param("direction", "sideways").with(OPS_USER))
                .andExpect(status().isBadRequest());
    }

    @Test
    void pageSizeIsCapped() throws Exception {
        mockMvc.perform(get("/api/trades").param("size", "500").with(OPS_USER))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.size").value("must be less than or equal to 100"));
        mockMvc.perform(get("/api/trades").param("page", "-1").with(OPS_USER))
                .andExpect(status().isBadRequest());
    }

    @Test
    void canFilterByTradeDateAndSide() throws Exception {
        clock.setDate(MONDAY.minusDays(3));
        submit(TRADER_1, "ACC-1001", "BUY", 10, "230");
        clock.setDate(MONDAY);
        submit(TRADER_1, "ACC-1001", "BUY", 20, "230");
        submit(TRADER_1, "ACC-1001", "SELL", 30, "230");

        mockMvc.perform(get("/api/trades").param("tradeDate", "2026-10-05").with(OPS_USER))
                .andExpect(jsonPath("$.totalElements").value(2));
        mockMvc.perform(get("/api/trades").param("tradeDate", "2026-10-05").param("side", "SELL").with(OPS_USER))
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].quantity").value(30));
        mockMvc.perform(get("/api/trades").param("tradeDate", "05/10/2026").with(OPS_USER))
                .andExpect(status().isBadRequest());
    }

    @Test
    void statusCountsIgnoreTheStatusFilterButApplyTheOthers() throws Exception {
        submit(TRADER_1, "ACC-1001", "BUY", 100, "230");       // accepted
        submit(TRADER_1, "ACC-1001", "BUY", 100, "300");       // rejected, price
        submit(TRADER_1, "ACC-1002", "BUY", 100, "230");       // accepted, other account
        submit(TRADER_1, "ACC-1004", "BUY", 100, "230");       // rejected, suspended

        mockMvc.perform(get("/api/trades/status-counts").with(OPS_USER))
                .andExpect(jsonPath("$.ACCEPTED").value(2))
                .andExpect(jsonPath("$.REJECTED").value(2))
                .andExpect(jsonPath("$.SETTLED").value(0));
        mockMvc.perform(get("/api/trades/status-counts").param("account", "ACC-1001").with(OPS_USER))
                .andExpect(jsonPath("$.ACCEPTED").value(1))
                .andExpect(jsonPath("$.REJECTED").value(1));
    }

    @Test
    void tradersOnlyCountTheirOwnTrades() throws Exception {
        submit(TRADER_1, "ACC-1001", "BUY", 100, "230");
        submit(TRADER_2, "ACC-1002", "BUY", 100, "230");
        submit(TRADER_2, "ACC-1002", "BUY", 100, "230");

        mockMvc.perform(get("/api/trades/status-counts").with(TRADER_1))
                .andExpect(jsonPath("$.ACCEPTED").value(1));
        mockMvc.perform(get("/api/trades/status-counts").with(OPS_USER))
                .andExpect(jsonPath("$.ACCEPTED").value(3));
    }

    @Test
    void responsesIncludeAccountAndInstrumentNames() throws Exception {
        submit(TRADER_1, "ACC-1001", "BUY", 100, "230");

        mockMvc.perform(get("/api/trades").with(TRADER_1))
                .andExpect(jsonPath("$.content[0].accountName").value("Harbor Growth Fund"))
                .andExpect(jsonPath("$.content[0].instrumentName").value("Apple Inc."));
    }
}
