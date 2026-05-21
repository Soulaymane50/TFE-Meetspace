package be.meetspace.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import java.util.Properties;

@Configuration
public class MailConfig {

    @Bean
    public JavaMailSender javaMailSender(@Value("${spring.mail.host:}") String host,
                                         @Value("${spring.mail.port:587}") int port,
                                         @Value("${spring.mail.username:}") String username,
                                         @Value("${spring.mail.password:}") String password,
                                         @Value("${spring.mail.properties.mail.smtp.auth:true}") boolean smtpAuth,
                                         @Value("${spring.mail.properties.mail.smtp.starttls.enable:true}") boolean startTls) {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(host);
        sender.setPort(port);
        sender.setUsername(username);
        sender.setPassword(normalizeSecret(password));
        sender.setDefaultEncoding("UTF-8");

        Properties properties = sender.getJavaMailProperties();
        properties.put("mail.smtp.auth", Boolean.toString(smtpAuth));
        properties.put("mail.smtp.starttls.enable", Boolean.toString(startTls));
        properties.put("mail.smtp.starttls.required", Boolean.toString(startTls));

        return sender;
    }

    private String normalizeSecret(String value) {
        return value == null ? "" : value.replaceAll("\\s+", "");
    }
}
