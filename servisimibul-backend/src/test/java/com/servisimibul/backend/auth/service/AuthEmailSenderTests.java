package com.servisimibul.backend.auth.service;

import com.servisimibul.backend.auth.config.AuthEmailProperties;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.EnableAsync;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class AuthEmailSenderTests {

    private static final String RESERVED_CHARACTER_TOKEN = "a+b/c=d&e f";
    private static final String ENCODED_RESERVED_CHARACTER_TOKEN = "a%2Bb%2Fc%3Dd%26e+f";

    @Test
    void verificationEmailLinksToTheOperatorVerificationRoute() {
        SimpleMailMessage message = deliveredVerification("https://example.com", RESERVED_CHARACTER_TOKEN);

        assertThat(message.getTo()).containsExactly("operator@example.com");
        assertThat(message.getSubject()).isEqualTo("ServisimiBul e-posta adresinizi doğrulayın");
        assertThat(message.getText()).isEqualTo(
                "E-posta adresinizi doğrulamak için bağlantıyı açın: "
                        + "https://example.com/operator/verify-email?token=" + ENCODED_RESERVED_CHARACTER_TOKEN
        );
    }

    @Test
    void verificationLinkKeepsAGeneratedOpaqueTokenUnchanged() {
        String token = new TokenGenerator().generate();

        SimpleMailMessage message = deliveredVerification("https://example.com/", token);

        assertThat(message.getText()).endsWith(
                " https://example.com/operator/verify-email?token=" + token
        );
    }

    @Test
    void passwordResetEmailLinksToTheResetRoute() {
        JavaMailSender mailSender = mock(JavaMailSender.class);

        sender(mailSender, "https://example.com/").sendPasswordReset(
                "operator@example.com",
                RESERVED_CHARACTER_TOKEN
        );

        SimpleMailMessage message = deliveredMessage(mailSender);
        assertThat(message.getSubject()).isEqualTo("ServisimiBul şifrenizi yenileyin");
        assertThat(message.getText()).isEqualTo(
                "Şifrenizi yenilemek için bağlantıyı açın: "
                        + "https://example.com/reset-password?token=" + ENCODED_RESERVED_CHARACTER_TOKEN
        );
    }

    @Test
    void smtpDeliveryDoesNotBlockTheCallingThread() throws Exception {
        CountDownLatch deliveryStarted = new CountDownLatch(1);
        CountDownLatch releaseDelivery = new CountDownLatch(1);
        JavaMailSender mailSender = mock(JavaMailSender.class);
        doAnswer(invocation -> {
            deliveryStarted.countDown();
            releaseDelivery.await(5, TimeUnit.SECONDS);
            return null;
        }).when(mailSender).send(any(SimpleMailMessage.class));

        try (var context = new AnnotationConfigApplicationContext()) {
            context.registerBean(JavaMailSender.class, () -> mailSender);
            context.register(AsyncEmailTestConfiguration.class);
            context.refresh();

            AuthEmailSender sender = context.getBean(AuthEmailSender.class);
            ExecutorService caller = Executors.newSingleThreadExecutor();
            try {
                Future<?> invocation = caller.submit(
                        () -> sender.sendVerification("operator@example.com", "raw-token")
                );

                assertThat(deliveryStarted.await(2, TimeUnit.SECONDS)).isTrue();
                invocation.get(500, TimeUnit.MILLISECONDS);
            } finally {
                releaseDelivery.countDown();
                caller.shutdownNow();
            }
        }
    }

    private SimpleMailMessage deliveredVerification(String frontendBaseUrl, String token) {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        sender(mailSender, frontendBaseUrl).sendVerification("operator@example.com", token);
        return deliveredMessage(mailSender);
    }

    private SmtpAuthEmailSender sender(JavaMailSender mailSender, String frontendBaseUrl) {
        return new SmtpAuthEmailSender(
                mailSender,
                new AuthEmailProperties("no-reply@example.com", frontendBaseUrl)
        );
    }

    private SimpleMailMessage deliveredMessage(JavaMailSender mailSender) {
        ArgumentCaptor<SimpleMailMessage> message = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(message.capture());
        return message.getValue();
    }

    @Configuration
    @EnableAsync
    static class AsyncEmailTestConfiguration {

        @Bean
        AuthEmailSender authEmailSender(JavaMailSender mailSender) {
            return new SmtpAuthEmailSender(
                    mailSender,
                    new AuthEmailProperties("no-reply@example.com", "https://example.com")
            );
        }
    }
}
