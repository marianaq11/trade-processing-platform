package com.tradeplatform.risk;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.tradeplatform.trade.Rejection;
import com.tradeplatform.trade.RejectionReason;
import com.tradeplatform.trade.Trade;
import com.tradeplatform.trade.TradeRepository;
import com.tradeplatform.trade.TradeStatus;

@Service
public class RiskCheckService {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    // Cancelled trades never settle, so they don't use up the daily limit.
    static final List<TradeStatus> COUNTS_TOWARD_DAILY_LIMIT = List.of(TradeStatus.ACCEPTED, TradeStatus.SETTLED);

    private final RiskLimitRepository riskLimitRepository;
    private final TradeRepository tradeRepository;

    public RiskCheckService(RiskLimitRepository riskLimitRepository, TradeRepository tradeRepository) {
        this.riskLimitRepository = riskLimitRepository;
        this.tradeRepository = tradeRepository;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public Optional<Rejection> check(Trade trade) {
        long accountId = trade.getAccount().getId();

        // Locking the limit row makes risk checks for the same account run one at a time.
        // Without it, two concurrent trades could both read the same daily total and both
        // pass. The lock is released when the submit transaction commits.
        Optional<RiskLimit> limit = riskLimitRepository.findByAccountIdForUpdate(accountId);
        if (limit.isEmpty()) {
            return Optional.of(new Rejection(RejectionReason.NO_RISK_LIMITS,
                    "No risk limits are set up for account " + trade.getAccount().getCode()));
        }

        BigDecimal acceptedToday = tradeRepository.sumNotional(accountId, trade.getTradeDate(),
                COUNTS_TOWARD_DAILY_LIMIT);
        return evaluate(trade, limit.get(), acceptedToday);
    }

    static Optional<Rejection> evaluate(Trade trade, RiskLimit limit, BigDecimal acceptedToday) {
        // Price check goes first: a fat-fingered price usually explains a huge notional too,
        // and it's the more useful reason to show.
        BigDecimal reference = trade.getInstrument().getReferencePrice();
        BigDecimal difference = trade.getPrice().subtract(reference).abs();
        BigDecimal allowedDifference = reference.multiply(limit.getPriceTolerancePct()).divide(HUNDRED);
        if (difference.compareTo(allowedDifference) > 0) {
            BigDecimal deviationPct = difference.multiply(HUNDRED).divide(reference, 2, RoundingMode.HALF_UP);
            return Optional.of(new Rejection(RejectionReason.PRICE_OUT_OF_TOLERANCE,
                    "Price %s is %s%% away from reference price %s (limit %s%%)".formatted(
                            trade.getPrice().stripTrailingZeros().toPlainString(), deviationPct,
                            reference.stripTrailingZeros().toPlainString(), limit.getPriceTolerancePct())));
        }

        if (trade.getNotional().compareTo(limit.getMaxTradeNotional()) > 0) {
            return Optional.of(new Rejection(RejectionReason.TRADE_NOTIONAL_LIMIT,
                    "Notional %s is over the single-trade limit of %s".formatted(
                            money(trade.getNotional()), money(limit.getMaxTradeNotional()))));
        }

        BigDecimal dailyTotal = acceptedToday.add(trade.getNotional());
        if (dailyTotal.compareTo(limit.getMaxDailyNotional()) > 0) {
            return Optional.of(new Rejection(RejectionReason.DAILY_NOTIONAL_LIMIT,
                    "Would bring today's notional to %s, over the daily limit of %s".formatted(
                            money(dailyTotal), money(limit.getMaxDailyNotional()))));
        }

        return Optional.empty();
    }

    private static String money(BigDecimal amount) {
        return "%,.2f".formatted(amount);
    }
}
