package com.tradeplatform.trade;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.ResultActions;

import com.jayway.jsonpath.JsonPath;
import com.tradeplatform.IntegrationTest;

@WithMockUser(username = "trader1", roles = "TRADER")
class TradeApiTest extends IntegrationTest {

    private ResultActions submit(String account, String symbol, String side, long quantity, String price)
            throws Exception {
        String body = """
                {"clientTradeId": "%s", "accountCode": "%s", "symbol": "%s",
                 "side": "%s", "quantity": %d, "price": %s}
                """.formatted(UUID.randomUUID(), account, symbol, side, quantity, price);
        return mockMvc.perform(post("/api/trades").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private long submitAndGetId(String account) throws Exception {
        String json = submit(account, "AAPL", "BUY", 100, "230.00").andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(json, "$.id")).longValue();
    }

    @Test
    void validTradeIsAccepted() throws Exception {
        submit("ACC-1001", "AAPL", "BUY", 100, "230.25")
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.notional").value("23025.0000"))
                .andExpect(jsonPath("$.rejectionReason").doesNotExist());
    }

    // As a JSON number, the browser reads 99999989900000.01 as 99999989900000.015625 and shows .02.
    @Test
    void largeNotionalIsSentAsExactDecimalText() throws Exception {
        String json = submit("ACC-1001", "AAPL", "BUY", 9_999_999, "9999999.99")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.notional").isString())
                .andExpect(jsonPath("$.notional").value("99999989900000.0100"))
                .andReturn().getResponse().getContentAsString();
        long id = ((Number) JsonPath.read(json, "$.id")).longValue();

        // read back from the database, the same text
        mockMvc.perform(get("/api/trades/{id}", id))
                .andExpect(jsonPath("$.notional").value("99999989900000.0100"));
        mockMvc.perform(get("/api/trades"))
                .andExpect(jsonPath("$.content[0].notional").value("99999989900000.0100"));
    }

    @Test
    void symbolIsCaseInsensitive() throws Exception {
        submit("ACC-1001", "msft", "SELL", 10, "450")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.symbol").value("MSFT"));
    }

    @Test
    void suspendedAccountIsStoredAsRejected() throws Exception {
        submit("ACC-1004", "AAPL", "BUY", 100, "230.00")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.rejectionReason").value("ACCOUNT_SUSPENDED"));
    }

    @Test
    void inactiveInstrumentIsStoredAsRejected() throws Exception {
        submit("ACC-1001", "BBBY", "BUY", 100, "0.10")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.rejectionReason").value("INSTRUMENT_INACTIVE"));
    }

    @Test
    void unknownSymbolIsABadRequestAndNotStored() throws Exception {
        submit("ACC-1001", "ZZZZ", "BUY", 100, "10.00")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Unknown symbol ZZZZ"));

        mockMvc.perform(get("/api/trades"))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void invalidFieldsAreListedInTheResponse() throws Exception {
        String body = """
                {"accountCode": "ACC-1001", "symbol": "AAPL", "side": "BUY", "quantity": -5, "price": 230}
                """;
        mockMvc.perform(post("/api/trades").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.clientTradeId").exists())
                .andExpect(jsonPath("$.errors.quantity").exists());
    }

    @Test
    void unknownSideIsABadRequest() throws Exception {
        submit("ACC-1001", "AAPL", "HOLD", 100, "230.00")
                .andExpect(status().isBadRequest());
    }

    @Test
    void historyShowsEachStep() throws Exception {
        long id = submitAndGetId("ACC-1001");

        mockMvc.perform(get("/api/trades/{id}/events", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].toStatus").value("RECEIVED"))
                .andExpect(jsonPath("$[1].toStatus").value("VALIDATED"))
                .andExpect(jsonPath("$[2].toStatus").value("ACCEPTED"))
                .andExpect(jsonPath("$[2].performedBy").value("system"));
    }

    @Test
    void filtersByStatusAndAccount() throws Exception {
        submitAndGetId("ACC-1001");
        submitAndGetId("ACC-1002");
        submitAndGetId("ACC-1004");

        mockMvc.perform(get("/api/trades").param("status", "ACCEPTED"))
                .andExpect(jsonPath("$.totalElements").value(2));
        mockMvc.perform(get("/api/trades").param("account", "ACC-1002"))
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].accountCode").value("ACC-1002"));
    }

    @Test
    void listIsNewestFirstAndPaged() throws Exception {
        long first = submitAndGetId("ACC-1001");
        long second = submitAndGetId("ACC-1001");
        submitAndGetId("ACC-1001");

        mockMvc.perform(get("/api/trades").param("size", "2").param("page", "1"))
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(first))
                .andExpect(jsonPath("$.totalPages").value(2));
        mockMvc.perform(get("/api/trades").param("size", "2"))
                .andExpect(jsonPath("$.content[1].id").value(second));
    }

    @Test
    void invalidStatusFilterIsABadRequest() throws Exception {
        mockMvc.perform(get("/api/trades").param("status", "PENDING"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void missingTradeIs404() throws Exception {
        mockMvc.perform(get("/api/trades/999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Trade 999999 not found"));
    }

    @Test
    void acceptedTradeCanBeCancelled() throws Exception {
        long id = submitAndGetId("ACC-1001");

        mockMvc.perform(post("/api/trades/{id}/cancel", id).with(csrf()).with(OPS_USER)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"Client called to cancel\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        mockMvc.perform(get("/api/trades/{id}/events", id))
                .andExpect(jsonPath("$[3].detail").value("Client called to cancel"));
    }

    @Test
    void rejectedTradeCannotBeCancelled() throws Exception {
        long id = submitAndGetId("ACC-1004");

        mockMvc.perform(post("/api/trades/{id}/cancel", id).with(csrf()).with(OPS_USER)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"test\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void cancelRequiresAReason() throws Exception {
        long id = submitAndGetId("ACC-1001");

        mockMvc.perform(post("/api/trades/{id}/cancel", id).with(csrf()).with(OPS_USER)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.reason").exists());
    }
}
