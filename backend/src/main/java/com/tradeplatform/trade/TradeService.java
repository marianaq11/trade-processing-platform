package com.tradeplatform.trade;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tradeplatform.account.Account;
import com.tradeplatform.account.AccountRepository;
import com.tradeplatform.common.BadRequestException;
import com.tradeplatform.common.NotFoundException;
import com.tradeplatform.common.PageResponse;
import com.tradeplatform.instrument.Instrument;
import com.tradeplatform.instrument.InstrumentRepository;

@Service
public class TradeService {

    private final TradeRepository tradeRepository;
    private final AccountRepository accountRepository;
    private final InstrumentRepository instrumentRepository;
    private final Clock clock;

    public TradeService(TradeRepository tradeRepository, AccountRepository accountRepository,
                        InstrumentRepository instrumentRepository, Clock clock) {
        this.tradeRepository = tradeRepository;
        this.accountRepository = accountRepository;
        this.instrumentRepository = instrumentRepository;
        this.clock = clock;
    }

    @Transactional
    public TradeResponse submit(SubmitTradeRequest request, String submittedBy) {
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
        return TradeResponse.from(trade);
    }

    private void process(Trade trade) {
        Optional<Rejection> validationFailure = validate(trade);
        if (validationFailure.isPresent()) {
            trade.reject(validationFailure.get());
            return;
        }
        trade.markValidated();
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

    @Transactional(readOnly = true)
    public TradeResponse getTrade(long id) {
        return TradeResponse.from(findTrade(id));
    }

    @Transactional(readOnly = true)
    public List<TradeEventResponse> getEvents(long id) {
        return findTrade(id).getEvents().stream()
                .map(TradeEventResponse::from)
                .toList();
    }

    @Transactional
    public TradeResponse cancel(long id, String reason, String cancelledBy) {
        Trade trade = findTrade(id);
        trade.cancel(reason, cancelledBy);
        return TradeResponse.from(trade);
    }

    private Trade findTrade(long id) {
        return tradeRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Trade " + id + " not found"));
    }
}
