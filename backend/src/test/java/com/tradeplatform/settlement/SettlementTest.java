package com.tradeplatform.settlement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.jayway.jsonpath.JsonPath;
import com.tradeplatform.IntegrationTest;
import com.tradeplatform.settlement.SettlementService.SettlementRun;

class SettlementTest extends IntegrationTest {

    private static final RequestPostProcessor TRADER = user("trader1").roles("TRADER");

    @Autowired
    private SettlementService settlementService;

    private long submitTrade(String account, String price) throws Exception {
        String body = """
                {"clientTradeId": "%s", "accountCode": "%s", "symbol": "AAPL",
                 "side": "BUY", "quantity": 100, "price": %s}
                """.formatted(UUID.randomUUID(), account, price);
        String json = mockMvc.perform(post("/api/trades").with(TRADER).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(json, "$.id")).longValue();
    }

    private long acceptedTrade() throws Exception {
        return submitTrade("ACC-1001", "230.00");
    }

    private String statusOf(long tradeId) {
        return jdbcTemplate.queryForObject("SELECT status FROM trade WHERE id = ?", String.class, tradeId);
    }

    private int settledEventCount(long tradeId) {
        return jdbcTemplate.queryForObject(
                "SELECT count(*) FROM trade_event WHERE trade_id = ? AND to_status = 'SETTLED'", Integer.class, tradeId);
    }

    @Test
    void tradeSettlesOnItsSettlementDateNotBefore() throws Exception {
        long id = acceptedTrade(); // Monday, settles Tuesday

        SettlementRun monday = settlementService.settleDueTrades("system");
        assertThat(monday.due()).isZero();
        assertThat(statusOf(id)).isEqualTo("ACCEPTED");

        clock.setDate(MONDAY.plusDays(1));
        SettlementRun tuesday = settlementService.settleDueTrades("system");

        assertThat(tuesday.settled()).isEqualTo(1);
        assertThat(statusOf(id)).isEqualTo("SETTLED");
    }

    @Test
    void settlementIsAddedToTheTradeHistory() throws Exception {
        long id = acceptedTrade();
        clock.setDate(MONDAY.plusDays(1));

        settlementService.settleDueTrades("system");

        mockMvc.perform(get("/api/trades/{id}/events", id).with(OPS_USER))
                .andExpect(jsonPath("$[3].fromStatus").value("ACCEPTED"))
                .andExpect(jsonPath("$[3].toStatus").value("SETTLED"))
                .andExpect(jsonPath("$[3].performedBy").value("system"));
    }

    @Test
    void fridayTradeWaitsUntilMonday() throws Exception {
        clock.setDate(MONDAY.minusDays(3)); // Friday
        long id = acceptedTrade();

        clock.setDate(MONDAY.minusDays(2)); // Saturday
        assertThat(settlementService.settleDueTrades("system").settled()).isZero();

        clock.setDate(MONDAY);
        assertThat(settlementService.settleDueTrades("system").settled()).isEqualTo(1);
        assertThat(statusOf(id)).isEqualTo("SETTLED");
    }

    @Test
    void missedRunsCatchUp() throws Exception {
        long id = acceptedTrade(); // due Tuesday

        clock.setDate(MONDAY.plusDays(3)); // nothing ran Tuesday or Wednesday
        settlementService.settleDueTrades("system");

        assertThat(statusOf(id)).isEqualTo("SETTLED");
    }

    @Test
    void secondRunHasNothingToDo() throws Exception {
        long id = acceptedTrade();
        clock.setDate(MONDAY.plusDays(1));

        SettlementRun first = settlementService.settleDueTrades("system");
        SettlementRun second = settlementService.settleDueTrades("system");

        assertThat(first.settled()).isEqualTo(1);
        assertThat(second.due()).isZero();
        assertThat(second.settled()).isZero();
        assertThat(settledEventCount(id)).isEqualTo(1);
    }

    @Test
    void rejectedAndCancelledTradesNeverSettle() throws Exception {
        long rejected = submitTrade("ACC-1004", "230.00"); // suspended account
        long cancelled = acceptedTrade();
        mockMvc.perform(post("/api/trades/{id}/cancel", cancelled).with(OPS_USER).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\": \"booked twice\"}"));

        clock.setDate(MONDAY.plusDays(7));
        SettlementRun run = settlementService.settleDueTrades("system");

        assertThat(run.due()).isZero();
        assertThat(statusOf(rejected)).isEqualTo("REJECTED");
        assertThat(statusOf(cancelled)).isEqualTo("CANCELLED");
    }

    @Test
    void settledTradeCannotBeCancelled() throws Exception {
        long id = acceptedTrade();
        clock.setDate(MONDAY.plusDays(1));
        settlementService.settleDueTrades("system");

        mockMvc.perform(post("/api/trades/{id}/cancel", id).with(OPS_USER).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"too late\"}"))
                .andExpect(status().isConflict());
        assertThat(statusOf(id)).isEqualTo("SETTLED");
    }

    @Test
    void overlappingRunsSettleEachTradeExactlyOnce() throws Exception {
        // e.g. an ops user presses "Run settlement" while the scheduled run is going
        int tradeCount = 12;
        List<Long> ids = new ArrayList<>();
        for (int i = 0; i < tradeCount; i++) {
            ids.add(acceptedTrade());
        }
        clock.setDate(MONDAY.plusDays(1));

        int runs = 3;
        ExecutorService executor = Executors.newFixedThreadPool(runs);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<SettlementRun>> futures = new ArrayList<>();
        for (int i = 0; i < runs; i++) {
            futures.add(executor.submit(() -> {
                start.await();
                return settlementService.settleDueTrades("system");
            }));
        }
        start.countDown();

        int totalSettled = 0;
        for (Future<SettlementRun> future : futures) {
            SettlementRun run = future.get();
            assertThat(run.failed()).isZero();
            totalSettled += run.settled();
        }
        executor.shutdown();

        assertThat(totalSettled).isEqualTo(tradeCount);
        for (long id : ids) {
            assertThat(settledEventCount(id)).isEqualTo(1);
        }
    }

    @Test
    void operationsCanRunSettlementManually() throws Exception {
        long id = acceptedTrade();
        clock.setDate(MONDAY.plusDays(1));

        mockMvc.perform(post("/api/settlement/run").with(OPS_USER).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.businessDate").value("2026-10-06"))
                .andExpect(jsonPath("$.settled").value(1));

        mockMvc.perform(get("/api/trades/{id}/events", id).with(OPS_USER))
                .andExpect(jsonPath("$[3].performedBy").value("ops1"));
    }

    @Test
    void statusShowsWhatIsDueNowAndLater() throws Exception {
        clock.setDate(MONDAY.minusDays(3)); // Friday, settles Monday
        acceptedTrade();
        clock.setDate(MONDAY);
        acceptedTrade(); // settles Tuesday
        acceptedTrade();

        mockMvc.perform(get("/api/settlement").with(OPS_USER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.businessDate").value("2026-10-05"))
                .andExpect(jsonPath("$.dueNow").value(1))
                .andExpect(jsonPath("$.awaitingLater").value(2));
    }

    @Test
    void onlyOperationsCanUseSettlementEndpoints() throws Exception {
        mockMvc.perform(post("/api/settlement/run").with(TRADER).with(csrf())).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/settlement/run").with(RISK_USER).with(csrf())).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/settlement").with(TRADER)).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/settlement/run").with(OPS_USER)).andExpect(status().isForbidden()); // no CSRF token
    }
}
