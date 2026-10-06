package com.tradeplatform.trade;

import java.util.ArrayList;
import java.util.List;

import org.springframework.data.jpa.domain.Specification;

import jakarta.persistence.criteria.Predicate;

public record TradeFilter(TradeStatus status, String accountCode, String symbol, String submittedBy) {

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
            if (submittedBy != null) {
                predicates.add(cb.equal(root.get("submittedBy"), submittedBy));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
