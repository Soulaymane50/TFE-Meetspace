package be.meetspace;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class MeetSpaceApplication {

    public static void main(String[] args) {
        SpringApplication.run(MeetSpaceApplication.class, args);
    }

}

