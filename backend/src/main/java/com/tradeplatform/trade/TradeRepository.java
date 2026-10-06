package com.tradeplatform.trade;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface TradeRepository extends JpaRepository<Trade, Long>, JpaSpecificationExecutor<Trade> {

    // Fetch account and instrument in the same query, otherwise each row in the blotter
    // triggers two extra selects.
    @Override
    @EntityGraph(attributePaths = {"account", "instrument"})
    Page<Trade> findAll(Specification<Trade> spec, Pageable pageable);
}
