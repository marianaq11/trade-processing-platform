package com.tradeplatform.settlement;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Operations only (see SecurityConfig). The manual run is the same code the scheduler calls.
@RestController
@RequestMapping("/api/settlement")
public class SettlementController {

    private final SettlementService settlementService;

    public SettlementController(SettlementService settlementService) {
        this.settlementService = settlementService;
    }

    @GetMapping
    public SettlementService.SettlementStatus status() {
        return settlementService.status();
    }

    @PostMapping("/run")
    public SettlementService.SettlementRun run(Authentication authentication) {
        return settlementService.settleDueTrades(authentication.getName());
    }
}
