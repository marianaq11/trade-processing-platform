package com.tradeplatform.risk;

import static java.util.stream.Collectors.toMap;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tradeplatform.account.Account;
import com.tradeplatform.account.AccountRepository;
import com.tradeplatform.common.ConflictException;
import com.tradeplatform.common.InvalidFieldException;
import com.tradeplatform.common.NotFoundException;
import com.tradeplatform.common.PageResponse;
import com.tradeplatform.trade.TradeRepository;

@Service
public class RiskLimitService {

    private final AccountRepository accountRepository;
    private final RiskLimitRepository riskLimitRepository;
    private final RiskLimitChangeRepository changeRepository;
    private final TradeRepository tradeRepository;
    private final Clock clock;

    public RiskLimitService(AccountRepository accountRepository, RiskLimitRepository riskLimitRepository,
                            RiskLimitChangeRepository changeRepository, TradeRepository tradeRepository,
                            Clock clock) {
        this.accountRepository = accountRepository;
        this.riskLimitRepository = riskLimitRepository;
        this.changeRepository = changeRepository;
        this.tradeRepository = tradeRepository;
        this.clock = clock;
    }

    // Every account is listed, including ones without limits, so they can be set up from here.
    @Transactional(readOnly = true)
    public List<RiskLimitResponse> listLimits() {
        Map<Long, RiskLimit> limitsByAccount = riskLimitRepository.findAll().stream()
                .collect(toMap(limit -> limit.getAccount().getId(), Function.identity()));
        Map<Long, BigDecimal> usedToday = tradeRepository
                .sumNotionalByAccount(LocalDate.now(clock), RiskCheckService.COUNTS_TOWARD_DAILY_LIMIT).stream()
                .collect(toMap(TradeRepository.AccountTotal::getAccountId, TradeRepository.AccountTotal::getTotal));

        return accountRepository.findAll(Sort.by("code")).stream()
                .map(account -> RiskLimitResponse.from(account, limitsByAccount.get(account.getId()),
                        usedToday.getOrDefault(account.getId(), BigDecimal.ZERO)))
                .toList();
    }

    @Transactional
    public RiskLimitResponse updateLimits(String accountCode, UpdateRiskLimitsRequest request, String changedBy) {
        Account account = accountRepository.findByCode(accountCode)
                .orElseThrow(() -> new NotFoundException("Account " + accountCode + " not found"));
        if (request.maxTradeNotional().compareTo(request.maxDailyNotional()) > 0) {
            throw new InvalidFieldException("maxTradeNotional", "Can't be more than the daily limit");
        }

        Instant now = Instant.now(clock);
        String reason = request.reason().trim();
        List<RiskLimitChange> changes = new ArrayList<>();

        // Takes the same row lock as the risk check, so concurrent saves queue up here and the
        // version check below sees whatever the previous save committed. The loser gets a clear
        // 409 instead of an optimistic-lock failure at commit time.
        Optional<RiskLimit> existing = riskLimitRepository.findByAccountIdForUpdate(account.getId());
        RiskLimit limit;
        if (existing.isPresent()) {
            limit = existing.get();
            if (request.version() == null || request.version() != limit.getVersion()) {
                throw new ConflictException("These limits were changed by " + limit.getUpdatedBy()
                        + " after you loaded them. Reload to see the current values.");
            }
            for (RiskLimitField field : RiskLimitField.values()) {
                BigDecimal oldValue = limit.get(field);
                BigDecimal newValue = request.get(field);
                if (oldValue.compareTo(newValue) != 0) {
                    changes.add(new RiskLimitChange(account, field, oldValue, newValue, reason, changedBy, now));
                }
            }
            if (changes.isEmpty()) {
                return RiskLimitResponse.from(account, limit, usedToday(account));
            }
            limit.update(request.maxTradeNotional(), request.maxDailyNotional(), request.priceTolerancePct(),
                    changedBy, now);
            // Flush now so the response carries the new version number.
            riskLimitRepository.flush();
        } else {
            limit = new RiskLimit(account, request.maxTradeNotional(), request.maxDailyNotional(),
                    request.priceTolerancePct(), changedBy, now);
            try {
                riskLimitRepository.saveAndFlush(limit);
            } catch (DataIntegrityViolationException e) {
                // Two people setting up limits for the same account at the same moment. There was no
                // row to lock yet, so the unique constraint on account_id catches it instead.
                throw new ConflictException("Limits for " + accountCode + " were just set up by someone else. "
                        + "Reload to see them.");
            }
            for (RiskLimitField field : RiskLimitField.values()) {
                changes.add(new RiskLimitChange(account, field, null, request.get(field), reason, changedBy, now));
            }
        }

        changeRepository.saveAll(changes);
        return RiskLimitResponse.from(account, limit, usedToday(account));
    }

    @Transactional(readOnly = true)
    public PageResponse<RiskLimitChangeResponse> findChanges(RiskLimitChangeFilter filter, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size,
                Sort.by(Sort.Order.desc("changedAt"), Sort.Order.desc("id")));
        return PageResponse.from(changeRepository.findAll(filter.toSpecification(), pageRequest)
                .map(RiskLimitChangeResponse::from));
    }

    private BigDecimal usedToday(Account account) {
        return tradeRepository.sumNotional(account.getId(), LocalDate.now(clock),
                RiskCheckService.COUNTS_TOWARD_DAILY_LIMIT);
    }
}
