package com.tradeplatform.trade;

import java.time.DayOfWeek;
import java.time.LocalDate;

final class SettlementDates {

    private SettlementDates() {
    }

    // US equities settle T+1 (since May 2024). Only weekends are skipped; market holidays
    // would need a holiday calendar, which is out of scope for now.
    static LocalDate settlementDateFor(LocalDate tradeDate) {
        LocalDate date = tradeDate.plusDays(1);
        while (date.getDayOfWeek() == DayOfWeek.SATURDAY || date.getDayOfWeek() == DayOfWeek.SUNDAY) {
            date = date.plusDays(1);
        }
        return date;
    }
}
