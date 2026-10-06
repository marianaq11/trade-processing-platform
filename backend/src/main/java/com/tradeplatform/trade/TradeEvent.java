package com.tradeplatform.trade;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;

@Entity
public class TradeEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Trade trade;

    @Enumerated(EnumType.STRING)
    private TradeStatus fromStatus;

    @Enumerated(EnumType.STRING)
    private TradeStatus toStatus;

    private String detail;

    private String performedBy;

    @CreationTimestamp
    private Instant createdAt;

    protected TradeEvent() {
    }

    TradeEvent(Trade trade, TradeStatus fromStatus, TradeStatus toStatus, String detail, String performedBy) {
        this.trade = trade;
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.detail = detail;
        this.performedBy = performedBy;
    }

    public Long getId() {
        return id;
    }

    public TradeStatus getFromStatus() {
        return fromStatus;
    }

    public TradeStatus getToStatus() {
        return toStatus;
    }

    public String getDetail() {
        return detail;
    }

    public String getPerformedBy() {
        return performedBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
