package com.tradeplatform.risk;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.tradeplatform.account.Account;
import com.tradeplatform.account.AccountStatus;
import com.tradeplatform.instrument.Instrument;
import com.tradeplatform.trade.Rejection;
import com.tradeplatform.trade.RejectionReason;
import com.tradeplatform.trade.Side;
import com.tradeplatform.trade.Trade;

// Tests the rule logic on its own; RiskCheckIntegrationTest covers loading limits and locking.
class RiskRulesTest {

    private final Account account = new Account("ACC-1", "Test Fund", AccountStatus.ACTIVE);
    private final Instrument instrument = new Instrument("AAPL", "Apple", new BigDecimal("200.00"), true);

    // max 100k per trade, 300k per day, price within 5% of reference
    private final RiskLimit limit = new RiskLimit(account, new BigDecimal("100000.00"),
            new BigDecimal("300000.00"), new BigDecimal("5.00"));

    private Trade trade(long quantity, String price) {
        return new Trade("t", account, instrument, Side.BUY, quantity, new BigDecimal(price),
                LocalDate.of(2026, 10, 5), LocalDate.of(2026, 10, 6), "alice");
    }

    private Optional<Rejection> evaluate(Trade trade, String acceptedToday) {
        return RiskCheckService.evaluate(trade, limit, new BigDecimal(acceptedToday));
    }

    @Test
    void passesWhenInsideAllLimits() {
        assertThat(evaluate(trade(100, "201.00"), "0")).isEmpty();
    }

    @Test
    void priceExactlyAtToleranceIsAllowed() {
        assertThat(evaluate(trade(10, "210.00"), "0")).isEmpty();
        assertThat(evaluate(trade(10, "190.00"), "0")).isEmpty();
    }

    @Test
    void rejectsPriceJustOutsideTolerance() {
        Optional<Rejection> result = evaluate(trade(10, "210.01"), "0");

        assertThat(result).get().extracting(Rejection::reason).isEqualTo(RejectionReason.PRICE_OUT_OF_TOLERANCE);
        assertThat(result.get().detail()).isEqualTo("Price 210.01 is 5.01% away from reference price 200 (limit 5.00%)");
    }

    @Test
    void priceCheckWinsOverNotionalCheck() {
        // A typo like 2000 instead of 200 breaks both rules; the price is the better explanation.
        assertThat(evaluate(trade(100, "2000.00"), "0"))
                .get().extracting(Rejection::reason).isEqualTo(RejectionReason.PRICE_OUT_OF_TOLERANCE);
    }

    @Test
    void rejectsSingleTradeOverNotionalLimit() {
        Optional<Rejection> result = evaluate(trade(501, "200.00"), "0");

        assertThat(result).get().extracting(Rejection::reason).isEqualTo(RejectionReason.TRADE_NOTIONAL_LIMIT);
        assertThat(result.get().detail()).isEqualTo("Notional 100,200.00 is over the single-trade limit of 100,000.00");
    }

    @Test
    void notionalExactlyAtLimitIsAllowed() {
        assertThat(evaluate(trade(500, "200.00"), "0")).isEmpty();
    }

    @Test
    void rejectsWhenDailyTotalWouldGoOverLimit() {
        Optional<Rejection> result = evaluate(trade(250, "200.00"), "260000.00");

        assertThat(result).get().extracting(Rejection::reason).isEqualTo(RejectionReason.DAILY_NOTIONAL_LIMIT);
        assertThat(result.get().detail()).contains("310,000.00");
    }

    @Test
    void dailyTotalExactlyAtLimitIsAllowed() {
        assertThat(evaluate(trade(250, "200.00"), "250000.00")).isEmpty();
    }
}
