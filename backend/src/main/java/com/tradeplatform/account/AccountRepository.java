package com.tradeplatform.account;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AccountRepository extends JpaRepository<Account, Long> {

    Optional<Account> findByCode(String code);

    // Entitlements live in the account_entitlement table (mapped on AppUser).
    @Query("select a from AppUser u join u.entitledAccounts a where u.username = :username order by a.code")
    List<Account> findEntitledAccounts(String username);

    @Query("select a from AppUser u join u.entitledAccounts a where u.username = :username and a.code = :code")
    Optional<Account> findEntitledAccount(String username, String code);
}
