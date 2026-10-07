package com.tradeplatform;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

import java.time.LocalDate;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

// Scheduled settlement is off so it can't fire mid-test, and the demo data isn't loaded.
@SpringBootTest(properties = {"settlement.cron=-", "spring.flyway.locations=classpath:db/migration"})
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Sql("/reset-test-data.sql")
public abstract class IntegrationTest {

    // A Monday, so T+1 is the next day. Tests that care about other days set the clock themselves.
    protected static final LocalDate MONDAY = LocalDate.of(2026, 10, 5);

    protected static final RequestPostProcessor OPS_USER = user("ops1").roles("OPERATIONS");
    protected static final RequestPostProcessor RISK_USER = user("risk1").roles("RISK_MANAGER");

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected JdbcTemplate jdbcTemplate;

    @Autowired
    protected MutableClock clock;

    @BeforeEach
    void resetClock() {
        clock.setDate(MONDAY);
    }
}
