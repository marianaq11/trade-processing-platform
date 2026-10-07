package com.tradeplatform.risk;

import java.util.ArrayList;
import java.util.List;

import org.springframework.data.jpa.domain.Specification;

import jakarta.persistence.criteria.Predicate;

public record RiskLimitChangeFilter(String accountCode, RiskLimitField field, String changedBy) {

    Specification<RiskLimitChange> toSpecification() {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (accountCode != null && !accountCode.isBlank()) {
                predicates.add(cb.equal(root.get("account").get("code"), accountCode));
            }
            if (field != null) {
                predicates.add(cb.equal(root.get("field"), field));
            }
            if (changedBy != null && !changedBy.isBlank()) {
                predicates.add(cb.equal(root.get("changedBy"), changedBy));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
