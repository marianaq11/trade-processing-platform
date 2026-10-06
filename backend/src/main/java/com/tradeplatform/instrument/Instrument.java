package com.tradeplatform.instrument;

import java.math.BigDecimal;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

@Entity
public class Instrument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String symbol;

    private String name;

    private BigDecimal referencePrice;

    private boolean active;

    protected Instrument() {
    }

    public Instrument(String symbol, String name, BigDecimal referencePrice, boolean active) {
        this.symbol = symbol;
        this.name = name;
        this.referencePrice = referencePrice;
        this.active = active;
    }

    public Long getId() {
        return id;
    }

    public String getSymbol() {
        return symbol;
    }

    public String getName() {
        return name;
    }

    public BigDecimal getReferencePrice() {
        return referencePrice;
    }

    public boolean isActive() {
        return active;
    }
}
