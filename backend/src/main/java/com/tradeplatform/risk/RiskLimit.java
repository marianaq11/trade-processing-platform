package com.tradeplatform.risk;

import java.math.BigDecimal;
import java.time.Instant;

import com.tradeplatform.account.Account;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToOne;

@Entity
public class RiskLimit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    private Account account;

    private BigDecimal maxTradeNotional;

    private BigDecimal maxDailyNotional;

    private BigDecimal priceTolerancePct;

    private Instant updatedAt;

    private String updatedBy;

    protected RiskLimit() {
    }

    public RiskLimit(Account account, BigDecimal maxTradeNotional, BigDecimal maxDailyNotional,
                     BigDecimal priceTolerancePct) {
        this.account = account;
        this.maxTradeNotional = maxTradeNotional;
        this.maxDailyNotional = maxDailyNotional;
        this.priceTolerancePct = priceTolerancePct;
    }

    public Long getId() {
        return id;
    }

    public Account getAccount() {
        return account;
    }

    public BigDecimal getMaxTradeNotional() {
        return maxTradeNotional;
    }

    public BigDecimal getMaxDailyNotional() {
        return maxDailyNotional;
    }

    public BigDecimal getPriceTolerancePct() {
        return priceTolerancePct;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public String getUpdatedBy() {
        return updatedBy;
    }
}
