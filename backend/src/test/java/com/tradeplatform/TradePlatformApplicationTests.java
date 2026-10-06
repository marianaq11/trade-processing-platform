package com.tradeplatform;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class TradePlatformApplicationTests {

    @Test
    void contextLoads() {
    }
}
