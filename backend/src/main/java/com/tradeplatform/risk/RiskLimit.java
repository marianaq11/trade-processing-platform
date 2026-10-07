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
import jakarta.persistence.Version;

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

    @Version
    private long version;

    protected RiskLimit() {
    }

    public RiskLimit(Account account, BigDecimal maxTradeNotional, BigDecimal maxDailyNotional,
                     BigDecimal priceTolerancePct, String updatedBy, Instant updatedAt) {
        this.account = account;
        update(maxTradeNotional, maxDailyNotional, priceTolerancePct, updatedBy, updatedAt);
    }

    void update(BigDecimal maxTradeNotional, BigDecimal maxDailyNotional, BigDecimal priceTolerancePct,
                String updatedBy, Instant updatedAt) {
        this.maxTradeNotional = maxTradeNotional;
        this.maxDailyNotional = maxDailyNotional;
        this.priceTolerancePct = priceTolerancePct;
        this.updatedBy = updatedBy;
        this.updatedAt = updatedAt;
    }

    BigDecimal get(RiskLimitField field) {
        return switch (field) {
            case MAX_TRADE_NOTIONAL -> maxTradeNotional;
            case MAX_DAILY_NOTIONAL -> maxDailyNotional;
            case PRICE_TOLERANCE_PCT -> priceTolerancePct;
        };
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

    public long getVersion() {
        return version;
    }
}
