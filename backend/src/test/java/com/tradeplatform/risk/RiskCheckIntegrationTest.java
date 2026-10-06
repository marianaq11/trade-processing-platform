package com.tradeplatform.risk;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import com.tradeplatform.IntegrationTest;
import com.tradeplatform.trade.Side;
import com.tradeplatform.trade.SubmitTradeRequest;
import com.tradeplatform.trade.TradeResponse;
import com.tradeplatform.trade.TradeService;
import com.tradeplatform.trade.TradeStatus;

// ACC-1002 is seeded with: 250k per trade, 1M per day, 5% price tolerance. AAPL reference is 230.
class RiskCheckIntegrationTest extends IntegrationTest {

    @Autowired
    private TradeService tradeService;

    private ResultActions submit(String account, long quantity, String price) throws Exception {
        String body = """
                {"clientTradeId": "%s", "accountCode": "%s", "symbol": "AAPL",
                 "side": "BUY", "quantity": %d, "price": %s}
                """.formatted(UUID.randomUUID(), account, quantity, price);
        return mockMvc.perform(post("/api/trades").contentType(MediaType.APPLICATION_JSON).content(body));
    }

    @Test
    void rejectsTradeOverSingleTradeLimit() throws Exception {
        submit("ACC-1002", 1100, "230.00")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.rejectionReason").value("TRADE_NOTIONAL_LIMIT"));
    }

    @Test
    void rejectsPriceFarFromReference() throws Exception {
        submit("ACC-1002", 10, "250.00")
                .andExpect(jsonPath("$.rejectionReason").value("PRICE_OUT_OF_TOLERANCE"));
    }

    @Test
    void accountWithoutLimitsIsRejected() throws Exception {
        submit("ACC-1003", 1, "230.00")
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.rejectionReason").value("NO_RISK_LIMITS"));
    }

    @Test
    void dailyLimitCountsEarlierAcceptedTrades() throws Exception {
        for (int i = 0; i < 4; i++) {
            submit("ACC-1002", 1000, "230.00").andExpect(jsonPath("$.status").value("ACCEPTED"));
        }
        // 4 x 230k = 920k already accepted, another 230k would make 1.15M
        submit("ACC-1002", 1000, "230.00")
                .andExpect(jsonPath("$.rejectionReason").value("DAILY_NOTIONAL_LIMIT"));
        // a smaller trade still fits under 1M
        submit("ACC-1002", 300, "230.00")
                .andExpect(jsonPath("$.status").value("ACCEPTED"));
    }

    @Test
    void cancelledTradesFreeUpTheDailyLimit() throws Exception {
        for (int i = 0; i < 4; i++) {
            submit("ACC-1002", 1000, "230.00");
        }
        Long id = jdbcTemplate.queryForObject("SELECT max(id) FROM trade", Long.class);
        mockMvc.perform(post("/api/trades/{id}/cancel", id)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\": \"duplicate booking\"}"));

        submit("ACC-1002", 1000, "230.00")
                .andExpect(jsonPath("$.status").value("ACCEPTED"));
    }

    @Test
    void concurrentTradesCannotOverrunDailyLimit() throws Exception {
        // 8 trades of 230k against a 1M limit: exactly 4 should fit. Without the row lock in
        // RiskCheckService, several threads read the same running total and too many get accepted.
        int threads = 8;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<TradeResponse>> results = new ArrayList<>();

        for (int i = 0; i < threads; i++) {
            results.add(executor.submit(() -> {
                start.await();
                SubmitTradeRequest request = new SubmitTradeRequest(UUID.randomUUID().toString(),
                        "ACC-1002", "AAPL", Side.BUY, 1000L, new BigDecimal("230.00"));
                return tradeService.submit(request, "load-test");
            }));
        }
        start.countDown();

        int accepted = 0;
        for (Future<TradeResponse> result : results) {
            if (result.get().status() == TradeStatus.ACCEPTED) {
                accepted++;
            }
        }
        executor.shutdown();

        assertThat(accepted).isEqualTo(4);
        BigDecimal acceptedNotional = jdbcTemplate.queryForObject(
                "SELECT sum(notional) FROM trade WHERE status = 'ACCEPTED'", BigDecimal.class);
        assertThat(acceptedNotional).isLessThanOrEqualTo(new BigDecimal("1000000"));
    }
}
