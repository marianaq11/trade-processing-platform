package com.tradeplatform.trade;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class SettlementDatesTest {

    @ParameterizedTest(name = "{0} settles {1}")
    @CsvSource({
            "2026-10-05, 2026-10-06", // Monday -> Tuesday
            "2026-10-08, 2026-10-09", // Thursday -> Friday
            "2026-10-09, 2026-10-12", // Friday -> Monday
            "2026-10-10, 2026-10-12", // Saturday -> Monday
            "2026-10-11, 2026-10-12", // Sunday -> Monday
            "2026-12-31, 2027-01-01"  // across a year boundary (holidays aren't modeled)
    })
    void settlesOneBusinessDayLater(LocalDate tradeDate, LocalDate expected) {
        assertThat(SettlementDates.settlementDateFor(tradeDate)).isEqualTo(expected);
    }
}
