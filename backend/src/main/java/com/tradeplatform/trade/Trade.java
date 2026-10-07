package com.tradeplatform.trade;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import com.tradeplatform.account.Account;
import com.tradeplatform.instrument.Instrument;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Version;

@Entity
public class Trade {

    static final String SYSTEM_USER = "system";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String clientTradeId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Account account;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Instrument instrument;

    @Enumerated(EnumType.STRING)
    private Side side;

    private long quantity;

    private BigDecimal price;

    private BigDecimal notional;

    private LocalDate tradeDate;

    private LocalDate settlementDate;

    @Enumerated(EnumType.STRING)
    private TradeStatus status;

    @Enumerated(EnumType.STRING)
    private RejectionReason rejectionReason;

    private String rejectionDetail;

    private String submittedBy;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;

    @Version
    private long version;

    @OneToMany(mappedBy = "trade", cascade = CascadeType.ALL)
    @OrderBy("id")
    private List<TradeEvent> events = new ArrayList<>();

    protected Trade() {
    }

    public Trade(String clientTradeId, Account account, Instrument instrument, Side side, long quantity,
                 BigDecimal price, LocalDate tradeDate, LocalDate settlementDate, String submittedBy) {
        this.clientTradeId = clientTradeId;
        this.account = account;
        this.instrument = instrument;
        this.side = side;
        this.quantity = quantity;
        this.price = price;
        this.notional = price.multiply(BigDecimal.valueOf(quantity));
        this.tradeDate = tradeDate;
        this.settlementDate = settlementDate;
        this.submittedBy = submittedBy;
        this.status = TradeStatus.RECEIVED;
        events.add(new TradeEvent(this, null, TradeStatus.RECEIVED, "Trade received", submittedBy));
    }

    public void markValidated() {
        changeStatus(TradeStatus.VALIDATED, "Passed validation", SYSTEM_USER);
    }

    public void accept() {
        changeStatus(TradeStatus.ACCEPTED, "Passed risk checks", SYSTEM_USER);
    }

    public void reject(Rejection rejection) {
        changeStatus(TradeStatus.REJECTED, rejection.detail(), SYSTEM_USER);
        this.rejectionReason = rejection.reason();
        this.rejectionDetail = rejection.detail();
    }

    public void cancel(String reason, String cancelledBy) {
        changeStatus(TradeStatus.CANCELLED, reason, cancelledBy);
    }

    // settledBy is "system" for the scheduled run, or the user who started a manual run.
    public void settle(String settledBy) {
        changeStatus(TradeStatus.SETTLED, "Settled", settledBy);
    }

    private void changeStatus(TradeStatus next, String detail, String performedBy) {
        if (!status.canTransitionTo(next)) {
            throw new TradeStateException("Trade " + id + " is " + status + " and cannot move to " + next);
        }
        events.add(new TradeEvent(this, status, next, detail, performedBy));
        status = next;
    }

    public Long getId() {
        return id;
    }

    public String getClientTradeId() {
        return clientTradeId;
    }

    public Account getAccount() {
        return account;
    }

    public Instrument getInstrument() {
        return instrument;
    }

    public Side getSide() {
        return side;
    }

    public long getQuantity() {
        return quantity;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public BigDecimal getNotional() {
        return notional;
    }

    public LocalDate getTradeDate() {
        return tradeDate;
    }

    public LocalDate getSettlementDate() {
        return settlementDate;
    }

    public TradeStatus getStatus() {
        return status;
    }

    public RejectionReason getRejectionReason() {
        return rejectionReason;
    }

    public String getRejectionDetail() {
        return rejectionDetail;
    }

    public String getSubmittedBy() {
        return submittedBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public List<TradeEvent> getEvents() {
        return List.copyOf(events);
    }
}
