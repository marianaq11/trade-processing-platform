package com.tradeplatform;

import java.time.Clock;
import java.time.ZoneId;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class TradePlatformApplication {

    public static void main(String[] args) {
        SpringApplication.run(TradePlatformApplication.class, args);
    }

    // Trade dates follow the New York market day, not whatever time zone the server is in.
    @Bean
    Clock clock() {
        return Clock.system(ZoneId.of("America/New_York"));
    }
}
