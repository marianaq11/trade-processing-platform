package com.tradeplatform;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.security.test.context.support.WithMockUser;

@WithMockUser(roles = "OPERATIONS")
class ReferenceDataApiTest extends IntegrationTest {

    @Test
    void listsSeededAccountsSortedByCode() throws Exception {
        mockMvc.perform(get("/api/accounts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(4)))
                .andExpect(jsonPath("$[0].code").value("ACC-1001"))
                .andExpect(jsonPath("$[3].status").value("SUSPENDED"));
    }

    @Test
    void listsInstrumentsWithReferencePrices() throws Exception {
        mockMvc.perform(get("/api/instruments"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].symbol").value("AAPL"))
                .andExpect(jsonPath("$[0].referencePrice").value(230.0))
                .andExpect(jsonPath("$[?(@.symbol == 'BBBY')].active").value(false));
    }
}
