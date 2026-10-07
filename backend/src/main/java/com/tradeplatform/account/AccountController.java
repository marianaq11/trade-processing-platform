package com.tradeplatform.account;

import java.util.List;

import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.tradeplatform.security.Role;
import com.tradeplatform.security.Roles;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {

    private final AccountRepository accountRepository;

    public AccountController(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    // Traders only get the accounts they're entitled to trade on; nothing about the others.
    // Operations and risk managers see every account.
    @GetMapping
    public List<AccountResponse> listAccounts(Authentication authentication) {
        List<Account> accounts = Roles.of(authentication) == Role.TRADER
                ? accountRepository.findEntitledAccounts(authentication.getName())
                : accountRepository.findAll(Sort.by("code"));
        return accounts.stream().map(AccountResponse::from).toList();
    }

    public record AccountResponse(String code, String name, AccountStatus status) {

        static AccountResponse from(Account account) {
            return new AccountResponse(account.getCode(), account.getName(), account.getStatus());
        }
    }
}
