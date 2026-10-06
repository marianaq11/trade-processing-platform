package com.tradeplatform.account;

import java.util.List;

import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {

    private final AccountRepository accountRepository;

    public AccountController(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    @GetMapping
    public List<AccountResponse> listAccounts() {
        return accountRepository.findAll(Sort.by("code")).stream()
                .map(AccountResponse::from)
                .toList();
    }

    public record AccountResponse(String code, String name, AccountStatus status) {

        static AccountResponse from(Account account) {
            return new AccountResponse(account.getCode(), account.getName(), account.getStatus());
        }
    }
}
