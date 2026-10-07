package com.tradeplatform.security;

import java.util.HashSet;
import java.util.Set;

import com.tradeplatform.account.Account;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;

@Entity
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String username;

    private String passwordHash;

    @Enumerated(EnumType.STRING)
    private Role role;

    // Accounts a trader may book trades on. Read through the queries in AccountRepository.
    @ManyToMany
    @JoinTable(name = "account_entitlement",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "account_id"))
    private Set<Account> entitledAccounts = new HashSet<>();

    protected AppUser() {
    }

    public String getUsername() {
        return username;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public Role getRole() {
        return role;
    }
}
