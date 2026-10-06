package com.tradeplatform.risk;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;

public interface RiskLimitRepository extends JpaRepository<RiskLimit, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from RiskLimit r where r.account.id = :accountId")
    Optional<RiskLimit> findByAccountIdForUpdate(long accountId);
}
