package com.tradeplatform.trade;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.ResultActions;

import com.jayway.jsonpath.JsonPath;
import com.tradeplatform.IntegrationTest;

@WithMockUser(username = "trader1", roles = "TRADER")
class DuplicateSubmissionTest extends IntegrationTest {

    @Autowired
    private TradeService tradeService;

    private ResultActions submit(String clientTradeId, String account, long quantity) throws Exception {
        String body = """
                {"clientTradeId": "%s", "accountCode": "%s", "symbol": "AAPL",
                 "side": "BUY", "quantity": %d, "price": 230.00}
                """.formatted(clientTradeId, account, quantity);
        return mockMvc.perform(post("/api/trades").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private int tradeCount() {
        return jdbcTemplate.queryForObject("SELECT count(*) FROM trade", Integer.class);
    }

    @Test
    void resubmittingTheSameTradeReturnsTheOriginal() throws Exception {
        String json = submit("order-1", "ACC-1001", 100)
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        Integer originalId = JsonPath.read(json, "$.id");

        submit("order-1", "ACC-1001", 100)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(originalId));

        assertThat(tradeCount()).isEqualTo(1);
    }

    @Test
    void sameIdWithDifferentDetailsIsAConflict() throws Exception {
        submit("order-1", "ACC-1001", 100).andExpect(status().isCreated());

        submit("order-1", "ACC-1001", 200)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(containsString("order-1")));

        assertThat(tradeCount()).isEqualTo(1);
    }

    @Test
    void sameIdOnDifferentAccountsIsAllowed() throws Exception {
        submit("order-1", "ACC-1001", 100).andExpect(status().isCreated());
        submit("order-1", "ACC-1002", 100).andExpect(status().isCreated());

        assertThat(tradeCount()).isEqualTo(2);
    }

    @Test
    void duplicateOfARejectedTradeReturnsTheRejection() throws Exception {
        submit("order-1", "ACC-1003", 100).andExpect(jsonPath("$.status").value("REJECTED"));

        submit("order-1", "ACC-1003", 100)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"));
    }

    @Test
    void concurrentDuplicatesCreateOnlyOneTrade() throws Exception {
        // Simulates a client retrying before the first response came back. Several threads get
        // past the duplicate lookup at the same time, so this exercises the unique-constraint path.
        int threads = 6;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        SubmitTradeRequest request = new SubmitTradeRequest("retry-me", "ACC-1001", "AAPL", Side.BUY,
                100L, new BigDecimal("230.00"));

        List<Future<TradeService.SubmitResult>> futures = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            futures.add(executor.submit(() -> {
                start.await();
                return tradeService.submit(request, "alice");
            }));
        }
        start.countDown();

        List<TradeService.SubmitResult> results = new ArrayList<>();
        for (Future<TradeService.SubmitResult> future : futures) {
            results.add(future.get());
        }
        executor.shutdown();

        assertThat(results).filteredOn(TradeService.SubmitResult::created).hasSize(1);
        assertThat(results).extracting(r -> r.trade().id()).containsOnly(results.getFirst().trade().id());
        assertThat(tradeCount()).isEqualTo(1);
    }
}
