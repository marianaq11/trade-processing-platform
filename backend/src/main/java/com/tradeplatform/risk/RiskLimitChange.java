package com.tradeplatform.risk;

import java.math.BigDecimal;
import java.time.Instant;

import com.tradeplatform.account.Account;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;

// Audit record for one risk limit field. Rows are only ever inserted, never updated.
@Entity
public class RiskLimitChange {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Account account;

    @Enumerated(EnumType.STRING)
    private RiskLimitField field;

    private BigDecimal oldValue;

    private BigDecimal newValue;

    private String reason;

    private String changedBy;

    private Instant changedAt;

    protected RiskLimitChange() {
    }

    RiskLimitChange(Account account, RiskLimitField field, BigDecimal oldValue, BigDecimal newValue,
                    String reason, String changedBy, Instant changedAt) {
        this.account = account;
        this.field = field;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.reason = reason;
        this.changedBy = changedBy;
        this.changedAt = changedAt;
    }

    public Long getId() {
        return id;
    }

    public Account getAccount() {
        return account;
    }

    public RiskLimitField getField() {
        return field;
    }

    public BigDecimal getOldValue() {
        return oldValue;
    }

    public BigDecimal getNewValue() {
        return newValue;
    }

    public String getReason() {
        return reason;
    }

    public String getChangedBy() {
        return changedBy;
    }

    public Instant getChangedAt() {
        return changedAt;
    }
}
