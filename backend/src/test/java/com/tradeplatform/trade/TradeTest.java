package com.tradeplatform.trade;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;

import com.tradeplatform.account.Account;
import com.tradeplatform.account.AccountStatus;
import com.tradeplatform.instrument.Instrument;

class TradeTest {

    private final Account account = new Account("ACC-1", "Test Fund", AccountStatus.ACTIVE);
    private final Instrument instrument = new Instrument("AAPL", "Apple", new BigDecimal("230.00"), true);

    private Trade newTrade() {
        return new Trade("client-1", account, instrument, Side.BUY, 150, new BigDecimal("229.5050"),
                LocalDate.of(2026, 10, 5), LocalDate.of(2026, 10, 6), "alice");
    }

    @Test
    void newTradeStartsReceivedWithOneEvent() {
        Trade trade = newTrade();

        assertThat(trade.getStatus()).isEqualTo(TradeStatus.RECEIVED);
        assertThat(trade.getEvents()).hasSize(1);
        assertThat(trade.getEvents().getFirst().getFromStatus()).isNull();
        assertThat(trade.getEvents().getFirst().getPerformedBy()).isEqualTo("alice");
    }

    @Test
    void notionalIsQuantityTimesPriceWithoutRounding() {
        assertThat(newTrade().getNotional()).isEqualByComparingTo("34425.7500");
    }

    @Test
    void recordsAnEventForEveryTransition() {
        Trade trade = newTrade();
        trade.markValidated();
        trade.accept();
        trade.cancel("Booked to wrong account", "ops-bob");

        assertThat(trade.getEvents())
                .extracting(TradeEvent::getToStatus)
                .containsExactly(TradeStatus.RECEIVED, TradeStatus.VALIDATED, TradeStatus.ACCEPTED,
                        TradeStatus.CANCELLED);
        assertThat(trade.getEvents().getLast().getPerformedBy()).isEqualTo("ops-bob");
        assertThat(trade.getEvents().getLast().getDetail()).isEqualTo("Booked to wrong account");
    }

    @Test
    void rejectStoresReasonAndDetail() {
        Trade trade = newTrade();
        trade.reject(new Rejection(RejectionReason.ACCOUNT_SUSPENDED, "Account ACC-1 is suspended"));

        assertThat(trade.getStatus()).isEqualTo(TradeStatus.REJECTED);
        assertThat(trade.getRejectionReason()).isEqualTo(RejectionReason.ACCOUNT_SUSPENDED);
        assertThat(trade.getRejectionDetail()).isEqualTo("Account ACC-1 is suspended");
    }

    @Test
    void cannotCancelARejectedTrade() {
        Trade trade = newTrade();
        trade.reject(new Rejection(RejectionReason.INSTRUMENT_INACTIVE, "not tradable"));

        assertThatThrownBy(() -> trade.cancel("oops", "ops-bob"))
                .isInstanceOf(TradeStateException.class)
                .hasMessageContaining("REJECTED");
        assertThat(trade.getEvents()).hasSize(2);
    }

    @Test
    void settlingRecordsWhoRanIt() {
        Trade trade = newTrade();
        trade.markValidated();
        trade.accept();
        trade.settle("ops-bob");

        assertThat(trade.getStatus()).isEqualTo(TradeStatus.SETTLED);
        assertThat(trade.getEvents().getLast().getPerformedBy()).isEqualTo("ops-bob");
    }

    @Test
    void onlyAcceptedTradesCanSettle() {
        Trade received = newTrade();
        Trade rejected = newTrade();
        rejected.reject(new Rejection(RejectionReason.ACCOUNT_SUSPENDED, "suspended"));
        Trade cancelled = newTrade();
        cancelled.markValidated();
        cancelled.accept();
        cancelled.cancel("mistake", "ops-bob");

        for (Trade trade : new Trade[] {received, rejected, cancelled}) {
            TradeStatus before = trade.getStatus();
            assertThatThrownBy(() -> trade.settle("system")).isInstanceOf(TradeStateException.class);
            assertThat(trade.getStatus()).isEqualTo(before);
        }
    }

    @Test
    void cannotAcceptWithoutValidatingFirst() {
        Trade trade = newTrade();

        assertThatThrownBy(trade::accept).isInstanceOf(TradeStateException.class);
        assertThat(trade.getStatus()).isEqualTo(TradeStatus.RECEIVED);
    }
}
