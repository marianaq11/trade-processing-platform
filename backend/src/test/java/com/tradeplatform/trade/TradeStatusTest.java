package com.tradeplatform.trade;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;

class TradeStatusTest {

    @ParameterizedTest
    @CsvSource({
            "RECEIVED, VALIDATED",
            "RECEIVED, REJECTED",
            "VALIDATED, ACCEPTED",
            "VALIDATED, REJECTED",
            "ACCEPTED, CANCELLED",
            "ACCEPTED, SETTLED"
    })
    void allowsLifecycleTransitions(TradeStatus from, TradeStatus to) {
        assertThat(from.canTransitionTo(to)).isTrue();
    }

    @ParameterizedTest
    @CsvSource({
            "RECEIVED, ACCEPTED",
            "VALIDATED, CANCELLED",
            "ACCEPTED, REJECTED",
            "RECEIVED, SETTLED"
    })
    void blocksSkippingSteps(TradeStatus from, TradeStatus to) {
        assertThat(from.canTransitionTo(to)).isFalse();
    }

    @ParameterizedTest
    @EnumSource(value = TradeStatus.class, names = {"REJECTED", "CANCELLED", "SETTLED"})
    void finalStatusesCannotChange(TradeStatus finalStatus) {
        for (TradeStatus next : TradeStatus.values()) {
            assertThat(finalStatus.canTransitionTo(next)).isFalse();
        }
    }

    @Test
    void cannotTransitionToSameStatus() {
        assertThat(TradeStatus.ACCEPTED.canTransitionTo(TradeStatus.ACCEPTED)).isFalse();
    }
}
