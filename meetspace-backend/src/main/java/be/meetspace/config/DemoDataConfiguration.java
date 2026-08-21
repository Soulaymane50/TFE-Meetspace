package be.meetspace.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

import javax.sql.DataSource;

@Configuration
@Profile("!prod")
public class DemoDataConfiguration {

    private static final Logger LOGGER = LoggerFactory.getLogger(DemoDataConfiguration.class);

    @Bean
    @ConditionalOnProperty(name = "app.demo.seed.enabled", havingValue = "true")
    ApplicationRunner demoDataSeeder(DataSource dataSource) {
        return new DemoDataSeeder(dataSource);
    }

    private static final class DemoDataSeeder implements ApplicationRunner {

        private final DataSource dataSource;

        private DemoDataSeeder(DataSource dataSource) {
            this.dataSource = dataSource;
        }

        @Override
        public void run(ApplicationArguments args) {
            ResourceDatabasePopulator populator = new ResourceDatabasePopulator();
            populator.setContinueOnError(false);
            populator.addScript(new ClassPathResource("demo/seed-data.sql"));
            populator.execute(dataSource);
            LOGGER.info("MeetSpace demonstration data is ready.");
        }
    }
}
