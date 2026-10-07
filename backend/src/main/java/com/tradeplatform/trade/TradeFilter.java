package com.tradeplatform.trade;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.jpa.domain.Specification;

import jakarta.persistence.criteria.Predicate;

public record TradeFilter(TradeStatus status, String accountCode, String symbol, Side side, LocalDate tradeDate,
                          String submittedBy) {

    // Used for the status counts, which show every status for the other filters.
    TradeFilter withoutStatus() {
        return new TradeFilter(null, accountCode, symbol, side, tradeDate, submittedBy);
    }

    Specification<Trade> toSpecification() {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (accountCode != null && !accountCode.isBlank()) {
                predicates.add(cb.equal(root.get("account").get("code"), accountCode));
            }
            if (symbol != null && !symbol.isBlank()) {
                predicates.add(cb.equal(root.get("instrument").get("symbol"), symbol.toUpperCase()));
            }
            if (side != null) {
                predicates.add(cb.equal(root.get("side"), side));
            }
            if (tradeDate != null) {
                predicates.add(cb.equal(root.get("tradeDate"), tradeDate));
            }
            if (submittedBy != null) {
                predicates.add(cb.equal(root.get("submittedBy"), submittedBy));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
