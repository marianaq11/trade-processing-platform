package com.tradeplatform.trade;

import java.net.URI;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.tradeplatform.common.PageResponse;
import com.tradeplatform.security.Role;
import com.tradeplatform.security.Roles;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

// Role checks for submit and cancel are in SecurityConfig.
@RestController
@RequestMapping("/api/trades")
public class TradeController {

    private final TradeService tradeService;

    public TradeController(TradeService tradeService) {
        this.tradeService = tradeService;
    }

    // 201 for a new trade, 200 if this clientTradeId was already submitted with the same details.
    // A rejected trade is still 201: it was recorded, the rejection is a business outcome.
    @PostMapping
    public ResponseEntity<TradeResponse> submitTrade(@Valid @RequestBody SubmitTradeRequest request,
                                                     Authentication authentication) {
        TradeService.SubmitResult result = tradeService.submit(request, authentication.getName());
        if (!result.created()) {
            return ResponseEntity.ok(result.trade());
        }
        return ResponseEntity.created(URI.create("/api/trades/" + result.trade().id())).body(result.trade());
    }

    @GetMapping
    public PageResponse<TradeResponse> listTrades(
            @RequestParam(required = false) TradeStatus status,
            @RequestParam(required = false) String account,
            @RequestParam(required = false) String symbol,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "25") @Min(1) @Max(100) int size,
            Authentication authentication) {
        TradeFilter filter = new TradeFilter(status, account, symbol, ownTradesOnly(authentication));
        return tradeService.findTrades(filter, page, size);
    }

    @GetMapping("/{id}")
    public TradeResponse getTrade(@PathVariable long id, Authentication authentication) {
        return tradeService.getTrade(id, ownTradesOnly(authentication));
    }

    @GetMapping("/{id}/events")
    public List<TradeEventResponse> getTradeEvents(@PathVariable long id, Authentication authentication) {
        return tradeService.getEvents(id, ownTradesOnly(authentication));
    }

    @PostMapping("/{id}/cancel")
    public TradeResponse cancelTrade(@PathVariable long id, @Valid @RequestBody CancelTradeRequest request,
                                     Authentication authentication) {
        return tradeService.cancel(id, request.reason(), authentication.getName());
    }

    // Traders only see trades they submitted. Operations and risk users see everything.
    private static String ownTradesOnly(Authentication authentication) {
        return Roles.of(authentication) == Role.TRADER ? authentication.getName() : null;
    }
}
