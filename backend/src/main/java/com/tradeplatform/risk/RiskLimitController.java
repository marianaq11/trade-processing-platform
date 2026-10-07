package com.tradeplatform.risk;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.tradeplatform.common.PageResponse;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

// Risk manager only; the rule is in SecurityConfig.
@RestController
public class RiskLimitController {

    private final RiskLimitService riskLimitService;

    public RiskLimitController(RiskLimitService riskLimitService) {
        this.riskLimitService = riskLimitService;
    }

    @GetMapping("/api/risk-limits")
    public List<RiskLimitResponse> listLimits() {
        return riskLimitService.listLimits();
    }

    @PutMapping("/api/risk-limits/{accountCode}")
    public RiskLimitResponse updateLimits(@PathVariable String accountCode,
                                          @Valid @RequestBody UpdateRiskLimitsRequest request,
                                          Authentication authentication) {
        return riskLimitService.updateLimits(accountCode, request, authentication.getName());
    }

    @GetMapping("/api/risk-limit-changes")
    public PageResponse<RiskLimitChangeResponse> listChanges(
            @RequestParam(required = false) String account,
            @RequestParam(required = false) RiskLimitField field,
            @RequestParam(required = false) String changedBy,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "25") @Min(1) @Max(100) int size) {
        return riskLimitService.findChanges(new RiskLimitChangeFilter(account, field, changedBy), page, size);
    }
}
