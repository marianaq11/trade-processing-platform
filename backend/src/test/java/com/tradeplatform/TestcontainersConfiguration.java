package com.tradeplatform;

import java.time.ZoneId;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.testcontainers.postgresql.PostgreSQLContainer;

// Tests run against real Postgres instead of H2 because later steps depend on
// row locking and unique constraints, which H2 doesn't behave the same way for.
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgres() {
        return new PostgreSQLContainer("postgres:17-alpine");
    }

    @Bean
    @Primary
    MutableClock testClock() {
        return new MutableClock(ZoneId.of("America/New_York"));
    }
}
