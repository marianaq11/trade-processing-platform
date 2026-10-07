package com.tradeplatform;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;

// Replaces the real clock in integration tests so "today" is whatever the test says it is.
public class MutableClock extends Clock {

    private final ZoneId zone;
    private Instant instant;

    public MutableClock(ZoneId zone) {
        this.zone = zone;
    }

    public void setDateTime(LocalDate date, LocalTime time) {
        this.instant = date.atTime(time).atZone(zone).toInstant();
    }

    public void setDate(LocalDate date) {
        setDateTime(date, LocalTime.of(10, 0));
    }

    @Override
    public ZoneId getZone() {
        return zone;
    }

    @Override
    public Clock withZone(ZoneId zone) {
        return Clock.fixed(instant, zone);
    }

    @Override
    public Instant instant() {
        return instant;
    }
}
