package com.tradeplatform.trade;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import com.tradeplatform.account.Account;
import com.tradeplatform.account.AccountRepository;
import com.tradeplatform.common.BadRequestException;
import com.tradeplatform.common.NotFoundException;
import com.tradeplatform.common.PageResponse;
import com.tradeplatform.instrument.Instrument;
import com.tradeplatform.instrument.InstrumentRepository;
import com.tradeplatform.risk.RiskCheckService;

@Service
public class TradeService {

    private final TradeRepository tradeRepository;
    private final AccountRepository accountRepository;
    private final InstrumentRepository instrumentRepository;
    private final RiskCheckService riskCheckService;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    public TradeService(TradeRepository tradeRepository, AccountRepository accountRepository,
                        InstrumentRepository instrumentRepository, RiskCheckService riskCheckService,
                        TransactionTemplate transactionTemplate, Clock clock) {
        this.tradeRepository = tradeRepository;
        this.accountRepository = accountRepository;
        this.instrumentRepository = instrumentRepository;
        this.riskCheckService = riskCheckService;
        this.transactionTemplate = transactionTemplate;
        this.clock = clock;
    }

    public record SubmitResult(TradeResponse trade, boolean created) {
    }

    // Uses TransactionTemplate instead of @Transactional because the duplicate fallback
    // has to run in a new transaction after the failed insert has rolled back.
    public SubmitResult submit(SubmitTradeRequest request, String submittedBy) {
        try {
            return transactionTemplate.execute(status -> submitInTransaction(request, submittedBy));
        } catch (DataIntegrityViolationException e) {
            // Two requests with the same clientTradeId both got past the duplicate check and
            // the unique constraint stopped the second insert. Return what the first one created.
            return transactionTemplate.execute(status -> findDuplicate(request, submittedBy).orElseThrow(() -> e));
        }
    }

    private SubmitResult submitInTransaction(SubmitTradeRequest request, String submittedBy) {
        Optional<SubmitResult> duplicate = findDuplicate(request, submittedBy);
        if (duplicate.isPresent()) {
            return duplicate.get();
        }

        // Unknown references are a bad request rather than a rejected trade: there's no
        // real account or instrument to attach the trade to.
        Account account = accountRepository.findByCode(request.accountCode())
                .orElseThrow(() -> new BadRequestException("Unknown account " + request.accountCode()));
        Instrument instrument = instrumentRepository.findBySymbol(request.symbol().toUpperCase())
                .orElseThrow(() -> new BadRequestException("Unknown symbol " + request.symbol()));

        LocalDate tradeDate = LocalDate.now(clock);
        Trade trade = new Trade(request.clientTradeId(), account, instrument, request.side(),
                request.quantity(), request.price(), tradeDate,
                SettlementDates.settlementDateFor(tradeDate), submittedBy);
        tradeRepository.save(trade);

        process(trade);
        return new SubmitResult(TradeResponse.from(trade), true);
    }

    private Optional<SubmitResult> findDuplicate(SubmitTradeRequest request, String submittedBy) {
        return tradeRepository.findByAccountCodeAndClientTradeId(request.accountCode(), request.clientTradeId())
                .map(existing -> {
                    // Only the same user resubmitting the same trade counts as a retry. Anything
                    // else is a conflict, and we don't hand back someone else's trade.
                    if (!existing.getSubmittedBy().equals(submittedBy) || !isSameTrade(existing, request)) {
                        throw new DuplicateTradeException("clientTradeId " + request.clientTradeId()
                                + " was already used for a different trade");
                    }
                    return new SubmitResult(TradeResponse.from(existing), false);
                });
    }

    private static boolean isSameTrade(Trade existing, SubmitTradeRequest request) {
        return existing.getInstrument().getSymbol().equalsIgnoreCase(request.symbol())
                && existing.getSide() == request.side()
                && existing.getQuantity() == request.quantity()
                && existing.getPrice().compareTo(request.price()) == 0;
    }

    private void process(Trade trade) {
        Optional<Rejection> validationFailure = validate(trade);
        if (validationFailure.isPresent()) {
            trade.reject(validationFailure.get());
            return;
        }
        trade.markValidated();

        Optional<Rejection> riskFailure = riskCheckService.check(trade);
        if (riskFailure.isPresent()) {
            trade.reject(riskFailure.get());
            return;
        }
        trade.accept();
    }

    private Optional<Rejection> validate(Trade trade) {
        if (!trade.getAccount().isActive()) {
            return Optional.of(new Rejection(RejectionReason.ACCOUNT_SUSPENDED,
                    "Account " + trade.getAccount().getCode() + " is suspended"));
        }
        if (!trade.getInstrument().isActive()) {
            return Optional.of(new Rejection(RejectionReason.INSTRUMENT_INACTIVE,
                    trade.getInstrument().getSymbol() + " is not currently tradable"));
        }
        return Optional.empty();
    }

    @Transactional(readOnly = true)
    public PageResponse<TradeResponse> findTrades(TradeFilter filter, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id"));
        return PageResponse.from(tradeRepository.findAll(filter.toSpecification(), pageRequest)
                .map(TradeResponse::from));
    }

    // restrictToSubmitter is set for traders, who can only see their own trades.
    @Transactional(readOnly = true)
    public TradeResponse getTrade(long id, String restrictToSubmitter) {
        return TradeResponse.from(findTrade(id, restrictToSubmitter));
    }

    @Transactional(readOnly = true)
    public List<TradeEventResponse> getEvents(long id, String restrictToSubmitter) {
        return findTrade(id, restrictToSubmitter).getEvents().stream()
                .map(TradeEventResponse::from)
                .toList();
    }

    @Transactional
    public TradeResponse cancel(long id, String reason, String cancelledBy) {
        Trade trade = findTrade(id, null);
        trade.cancel(reason, cancelledBy);
        return TradeResponse.from(trade);
    }

    // Someone else's trade is reported as not found rather than forbidden, so a trader
    // can't probe which trade ids exist.
    private Trade findTrade(long id, String restrictToSubmitter) {
        return tradeRepository.findById(id)
                .filter(trade -> restrictToSubmitter == null || trade.getSubmittedBy().equals(restrictToSubmitter))
                .orElseThrow(() -> new NotFoundException("Trade " + id + " not found"));
    }
}
