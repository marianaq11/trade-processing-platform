package com.tradeplatform.risk;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.LocalTime;
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
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.tradeplatform.IntegrationTest;
import com.tradeplatform.common.ConflictException;

// Seeded limits: ACC-1001 1M / 5M / 10%, ACC-1002 250k / 1M / 5%, ACC-1003 none.
class RiskLimitApiTest extends IntegrationTest {

    private static final RequestPostProcessor TRADER = user("trader1").roles("TRADER");

    @Autowired
    private RiskLimitService riskLimitService;

    private ResultActions updateLimits(String account, String maxTrade, String maxDaily, String tolerance,
                                       String reason, Long version) throws Exception {
        String body = """
                {"maxTradeNotional": %s, "maxDailyNotional": %s, "priceTolerancePct": %s,
                 "reason": %s, "version": %s}
                """.formatted(maxTrade, maxDaily, tolerance,
                reason == null ? "null" : "\"" + reason + "\"", version);
        return mockMvc.perform(put("/api/risk-limits/{account}", account).with(RISK_USER).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private ResultActions submitTrade(String account, long quantity, String price) throws Exception {
        String body = """
                {"clientTradeId": "%s", "accountCode": "%s", "symbol": "AAPL",
                 "side": "BUY", "quantity": %d, "price": %s}
                """.formatted(UUID.randomUUID(), account, quantity, price);
        return mockMvc.perform(post("/api/trades").with(TRADER).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private int auditRowCount() {
        return jdbcTemplate.queryForObject("SELECT count(*) FROM risk_limit_change", Integer.class);
    }

    @Test
    void listsEveryAccountIncludingOnesWithoutLimits() throws Exception {
        mockMvc.perform(get("/api/risk-limits").with(RISK_USER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(4)))
                .andExpect(jsonPath("$[0].accountCode").value("ACC-1001"))
                .andExpect(jsonPath("$[0].maxTradeNotional").value(1000000.0))
                .andExpect(jsonPath("$[0].updatedBy").value("system"))
                .andExpect(jsonPath("$[2].accountCode").value("ACC-1003"))
                .andExpect(jsonPath("$[2].maxTradeNotional").value(nullValue()))
                .andExpect(jsonPath("$[2].version").value(nullValue()));
    }

    @Test
    void usedTodayOnlyCountsTodaysAcceptedTrades() throws Exception {
        submitTrade("ACC-1002", 1000, "230.00");                // accepted, 230k
        submitTrade("ACC-1002", 10, "300.00");                  // rejected on price, not counted
        clock.setDate(MONDAY.minusDays(3));
        submitTrade("ACC-1002", 100, "230.00");                 // last Friday, not counted
        clock.setDate(MONDAY);

        mockMvc.perform(get("/api/risk-limits").with(RISK_USER))
                .andExpect(jsonPath("$[1].accountCode").value("ACC-1002"))
                .andExpect(jsonPath("$[1].usedToday").value(230000.0))
                .andExpect(jsonPath("$[0].usedToday").value(0));
    }

    @Test
    void updateRecordsOneAuditRowPerChangedField() throws Exception {
        clock.setDateTime(MONDAY, LocalTime.of(14, 30));

        updateLimits("ACC-1001", "1000000", "7500000", "7.5", "Approved by credit committee", 0L)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maxDailyNotional").value(7500000))
                .andExpect(jsonPath("$.priceTolerancePct").value(7.5))
                .andExpect(jsonPath("$.updatedBy").value("risk1"))
                .andExpect(jsonPath("$.updatedAt").value("2026-10-05T18:30:00Z"))
                .andExpect(jsonPath("$.version").value(1));

        // max trade notional didn't change, so only two rows
        mockMvc.perform(get("/api/risk-limit-changes").with(RISK_USER))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[?(@.field == 'MAX_DAILY_NOTIONAL')].oldValue").value(5000000.0))
                .andExpect(jsonPath("$.content[?(@.field == 'MAX_DAILY_NOTIONAL')].newValue").value(7500000.0))
                .andExpect(jsonPath("$.content[?(@.field == 'PRICE_TOLERANCE_PCT')].oldValue").value(10.0))
                .andExpect(jsonPath("$.content[0].accountCode").value("ACC-1001"))
                .andExpect(jsonPath("$.content[0].changedBy").value("risk1"))
                .andExpect(jsonPath("$.content[0].reason").value("Approved by credit committee"))
                .andExpect(jsonPath("$.content[0].changedAt").value("2026-10-05T18:30:00Z"));
    }

    @Test
    void savingWithoutChangesWritesNothing() throws Exception {
        updateLimits("ACC-1001", "1000000.00", "5000000", "10", "No change", 0L)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(0))
                .andExpect(jsonPath("$.updatedBy").value("system"));

        assertThat(auditRowCount()).isZero();
    }

    @Test
    void staleVersionIsAConflict() throws Exception {
        updateLimits("ACC-1001", "900000", "5000000", "10", "First edit", 0L).andExpect(status().isOk());

        // someone else still has version 0 open
        updateLimits("ACC-1001", "800000", "5000000", "10", "Second edit", 0L)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(containsString("risk1")));

        assertThat(auditRowCount()).isEqualTo(1);
        mockMvc.perform(get("/api/risk-limits").with(RISK_USER))
                .andExpect(jsonPath("$[0].maxTradeNotional").value(900000));
    }

    @Test
    void settingUpLimitsForANewAccountLetsItTrade() throws Exception {
        submitTrade("ACC-1003", 10, "230.00")
                .andExpect(jsonPath("$.rejectionReason").value("NO_RISK_LIMITS"));

        updateLimits("ACC-1003", "100000", "400000", "5", "Account onboarded", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(0));

        mockMvc.perform(get("/api/risk-limit-changes").param("account", "ACC-1003").with(RISK_USER))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.content[0].oldValue").value(nullValue()));

        submitTrade("ACC-1003", 10, "230.00")
                .andExpect(jsonPath("$.status").value("ACCEPTED"));
    }

    @Test
    void newLimitsApplyToTheNextTrade() throws Exception {
        submitTrade("ACC-1001", 100, "230.00").andExpect(jsonPath("$.status").value("ACCEPTED"));

        updateLimits("ACC-1001", "10000", "5000000", "10", "Reduce exposure", 0L).andExpect(status().isOk());

        submitTrade("ACC-1001", 100, "230.00")
                .andExpect(jsonPath("$.rejectionReason").value("TRADE_NOTIONAL_LIMIT"));
    }

    @Test
    void invalidValuesAreReportedPerField() throws Exception {
        updateLimits("ACC-1001", "-5", "1000000.123", "150", "", 0L)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.maxTradeNotional").value("Must be greater than 0"))
                .andExpect(jsonPath("$.errors.maxDailyNotional").value("Use at most 15 digits and 2 decimal places"))
                .andExpect(jsonPath("$.errors.priceTolerancePct").value("Can't be more than 100%"))
                .andExpect(jsonPath("$.errors.reason").value("Give a reason for the change"));

        assertThat(auditRowCount()).isZero();
    }

    @Test
    void missingValuesAreRequired() throws Exception {
        updateLimits("ACC-1001", "null", "null", "null", "test", 0L)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.maxTradeNotional").value("Required"))
                .andExpect(jsonPath("$.errors.priceTolerancePct").value("Required"));
    }

    @Test
    void tradeLimitCannotBeAboveDailyLimit() throws Exception {
        updateLimits("ACC-1001", "2000000", "1000000", "10", "test", 0L)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.maxTradeNotional").value("Can't be more than the daily limit"));
    }

    @Test
    void unknownAccountIs404() throws Exception {
        updateLimits("ACC-9999", "1000", "2000", "5", "test", null)
                .andExpect(status().isNotFound());
    }

    @Test
    void auditLogCanBeFilteredByAccountAndField() throws Exception {
        updateLimits("ACC-1001", "900000", "4000000", "10", "Edit 1001", 0L);
        updateLimits("ACC-1002", "200000", "1000000", "4", "Edit 1002", 0L);

        mockMvc.perform(get("/api/risk-limit-changes").param("account", "ACC-1002").with(RISK_USER))
                .andExpect(jsonPath("$.totalElements").value(2));
        mockMvc.perform(get("/api/risk-limit-changes").param("field", "MAX_TRADE_NOTIONAL").with(RISK_USER))
                .andExpect(jsonPath("$.totalElements").value(2));
        mockMvc.perform(get("/api/risk-limit-changes")
                        .param("account", "ACC-1001").param("field", "PRICE_TOLERANCE_PCT").with(RISK_USER))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void auditLogIsNewestFirst() throws Exception {
        clock.setDateTime(MONDAY, LocalTime.of(9, 0));
        updateLimits("ACC-1001", "900000", "5000000", "10", "Morning", 0L);
        clock.setDateTime(MONDAY, LocalTime.of(15, 0));
        updateLimits("ACC-1001", "800000", "5000000", "10", "Afternoon", 1L);

        mockMvc.perform(get("/api/risk-limit-changes").with(RISK_USER))
                .andExpect(jsonPath("$.content[0].reason").value("Afternoon"))
                .andExpect(jsonPath("$.content[0].oldValue").value(900000))
                .andExpect(jsonPath("$.content[1].reason").value("Morning"));
    }

    @Test
    void onlyRiskManagersCanSeeOrChangeLimits() throws Exception {
        mockMvc.perform(get("/api/risk-limits").with(TRADER)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/risk-limits").with(OPS_USER)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/risk-limit-changes").with(TRADER)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/risk-limit-changes").with(OPS_USER)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/risk-limits")).andExpect(status().isUnauthorized());

        mockMvc.perform(put("/api/risk-limits/ACC-1001").with(OPS_USER).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"maxTradeNotional": 1, "maxDailyNotional": 1, "priceTolerancePct": 1,
                                 "reason": "sneaky", "version": 0}
                                """))
                .andExpect(status().isForbidden());

        assertThat(auditRowCount()).isZero();
    }

    @Test
    void updateWithoutCsrfTokenIsForbidden() throws Exception {
        mockMvc.perform(put("/api/risk-limits/ACC-1001").with(RISK_USER)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"maxTradeNotional": 1, "maxDailyNotional": 1, "priceTolerancePct": 1,
                                 "reason": "test", "version": 0}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    void concurrentEditsFromTheSameVersionOnlyApplyOnce() throws Exception {
        // Two risk managers open the same limits and both press save. The row lock makes the
        // second one wait, then the version check rejects it instead of silently overwriting.
        int threads = 4;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Boolean>> results = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            BigDecimal maxTrade = BigDecimal.valueOf(500_000 + i);
            results.add(executor.submit(() -> {
                start.await();
                try {
                    riskLimitService.updateLimits("ACC-1001", new UpdateRiskLimitsRequest(maxTrade,
                            new BigDecimal("5000000"), BigDecimal.TEN, "race", 0L), "risk1");
                    return true;
                } catch (ConflictException e) {
                    return false;
                }
            }));
        }
        start.countDown();

        int succeeded = 0;
        for (Future<Boolean> result : results) {
            if (result.get()) {
                succeeded++;
            }
        }
        executor.shutdown();

        assertThat(succeeded).isEqualTo(1);
        assertThat(auditRowCount()).isEqualTo(1);
        BigDecimal oldValue = jdbcTemplate.queryForObject("SELECT old_value FROM risk_limit_change", BigDecimal.class);
        assertThat(oldValue).isEqualByComparingTo("1000000");
    }
}
