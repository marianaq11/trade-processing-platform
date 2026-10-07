package com.tradeplatform.risk;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface RiskLimitChangeRepository extends JpaRepository<RiskLimitChange, Long>,
        JpaSpecificationExecutor<RiskLimitChange> {

    @Override
    @EntityGraph(attributePaths = "account")
    Page<RiskLimitChange> findAll(Specification<RiskLimitChange> spec, Pageable pageable);
}
