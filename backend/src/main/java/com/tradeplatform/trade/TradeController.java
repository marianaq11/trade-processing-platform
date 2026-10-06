package com.tradeplatform.trade;

import java.net.URI;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.tradeplatform.common.PageResponse;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

@RestController
@RequestMapping("/api/trades")
public class TradeController {

    // TODO: use the logged-in user once authentication is added
    private static final String CURRENT_USER = "demo-user";

    private final TradeService tradeService;

    public TradeController(TradeService tradeService) {
        this.tradeService = tradeService;
    }

    @PostMapping
    public ResponseEntity<TradeResponse> submitTrade(@Valid @RequestBody SubmitTradeRequest request) {
        TradeResponse trade = tradeService.submit(request, CURRENT_USER);
        return ResponseEntity.created(URI.create("/api/trades/" + trade.id())).body(trade);
    }

    @GetMapping
    public PageResponse<TradeResponse> listTrades(
            @RequestParam(required = false) TradeStatus status,
            @RequestParam(required = false) String account,
            @RequestParam(required = false) String symbol,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "25") @Min(1) @Max(100) int size) {
        return tradeService.findTrades(new TradeFilter(status, account, symbol), page, size);
    }

    @GetMapping("/{id}")
    public TradeResponse getTrade(@PathVariable long id) {
        return tradeService.getTrade(id);
    }

    @GetMapping("/{id}/events")
    public List<TradeEventResponse> getTradeEvents(@PathVariable long id) {
        return tradeService.getEvents(id);
    }

    @PostMapping("/{id}/cancel")
    public TradeResponse cancelTrade(@PathVariable long id, @Valid @RequestBody CancelTradeRequest request) {
        return tradeService.cancel(id, request.reason(), CURRENT_USER);
    }
}
