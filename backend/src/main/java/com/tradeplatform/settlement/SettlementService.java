package com.tradeplatform.settlement;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import com.tradeplatform.trade.Trade;
import com.tradeplatform.trade.TradeRepository;
import com.tradeplatform.trade.TradeStatus;

@Service
public class SettlementService {

    private static final Logger log = LoggerFactory.getLogger(SettlementService.class);

    private final TradeRepository tradeRepository;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    public SettlementService(TradeRepository tradeRepository, TransactionTemplate transactionTemplate, Clock clock) {
        this.tradeRepository = tradeRepository;
        this.transactionTemplate = transactionTemplate;
        this.clock = clock;
    }

    public record SettlementRun(LocalDate businessDate, int due, int settled, int skipped, int failed) {
    }

    public record SettlementStatus(LocalDate businessDate, long dueNow, long awaitingLater) {
    }

    // Schedule comes from settlement.cron in application.yml; tests set it to "-" to switch it off.
    @Scheduled(cron = "${settlement.cron}", zone = "America/New_York")
    public void runScheduled() {
        SettlementRun run = settleDueTrades("system");
        log.info("Scheduled settlement for {}: {} due, {} settled, {} skipped, {} failed",
                run.businessDate(), run.due(), run.settled(), run.skipped(), run.failed());
    }

    // Settles every ACCEPTED trade whose settlement date is today or earlier, so a missed run
    // (app down over a weekend, say) catches up next time. Running it again straight away finds
    // nothing left to do, which is what makes repeated or overlapping runs safe.
    public SettlementRun settleDueTrades(String runBy) {
        LocalDate today = LocalDate.now(clock);
        List<Long> dueIds = tradeRepository.findIdsDueForSettlement(today);

        int settled = 0;
        int skipped = 0;
        int failed = 0;
        // One transaction per trade, so one bad trade doesn't undo the others that already settled.
        for (long id : dueIds) {
            try {
                Boolean didSettle = transactionTemplate.execute(status -> settleIfStillDue(id, today, runBy));
                if (Boolean.TRUE.equals(didSettle)) {
                    settled++;
                } else {
                    skipped++;
                }
            } catch (OptimisticLockingFailureException e) {
                // Something else changed the trade between our read and our write (ops cancelling it,
                // or an overlapping run). Its new state wins; if it's still due, the next run gets it.
                log.info("Trade {} changed during settlement, skipping it", id);
                skipped++;
            } catch (RuntimeException e) {
                log.error("Could not settle trade {}", id, e);
                failed++;
            }
        }
        return new SettlementRun(today, dueIds.size(), settled, skipped, failed);
    }

    private boolean settleIfStillDue(long id, LocalDate today, String runBy) {
        Trade trade = tradeRepository.findById(id).orElseThrow();
        // The id list was loaded outside this transaction, so check again: it may have been
        // cancelled, or settled by another run, in the meantime.
        if (trade.getStatus() != TradeStatus.ACCEPTED || trade.getSettlementDate().isAfter(today)) {
            return false;
        }
        trade.settle(runBy);
        return true;
    }

    @Transactional(readOnly = true)
    public SettlementStatus status() {
        LocalDate today = LocalDate.now(clock);
        long dueNow = tradeRepository.countByStatusAndSettlementDateLessThanEqual(TradeStatus.ACCEPTED, today);
        long awaiting = tradeRepository.countByStatus(TradeStatus.ACCEPTED);
        return new SettlementStatus(today, dueNow, awaiting - dueNow);
    }
}
