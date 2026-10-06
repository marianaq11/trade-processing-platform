package com.tradeplatform.trade;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

public interface TradeRepository extends JpaRepository<Trade, Long>, JpaSpecificationExecutor<Trade> {

    // Fetch account and instrument in the same query, otherwise each row in the blotter
    // triggers two extra selects.
    @Override
    @EntityGraph(attributePaths = {"account", "instrument"})
    Page<Trade> findAll(Specification<Trade> spec, Pageable pageable);

    Optional<Trade> findByAccountCodeAndClientTradeId(String accountCode, String clientTradeId);

    @Query("""
            select coalesce(sum(t.notional), 0) from Trade t
            where t.account.id = :accountId and t.tradeDate = :tradeDate and t.status in :statuses
            """)
    BigDecimal sumNotional(long accountId, LocalDate tradeDate, Collection<TradeStatus> statuses);
}
