package com.tradeplatform.instrument;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/instruments")
public class InstrumentController {

    private final InstrumentRepository instrumentRepository;

    public InstrumentController(InstrumentRepository instrumentRepository) {
        this.instrumentRepository = instrumentRepository;
    }

    @GetMapping
    public List<InstrumentResponse> listInstruments() {
        return instrumentRepository.findAll(Sort.by("symbol")).stream()
                .map(InstrumentResponse::from)
                .toList();
    }

    public record InstrumentResponse(String symbol, String name, BigDecimal referencePrice, boolean active) {

        static InstrumentResponse from(Instrument instrument) {
            return new InstrumentResponse(instrument.getSymbol(), instrument.getName(),
                    instrument.getReferencePrice(), instrument.isActive());
        }
    }
}
