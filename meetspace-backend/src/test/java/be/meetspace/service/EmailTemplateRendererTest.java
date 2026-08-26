package be.meetspace.service;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class EmailTemplateRendererTest {

    @Test
    void rendersMeetSpaceBrandAndUsefulFallbackContent() {
        Map<String, String> details = new LinkedHashMap<>();
        details.put("Référence", "ROOM-42");
        details.put("Prix total", "120,00 €");

        EmailTemplateRenderer.EmailContent content = EmailTemplateRenderer.render(
                "Réservation confirmée",
                "Votre salle est réservée.",
                "Bonjour Nora,",
                details,
                "Voir mes réservations",
                "https://tfe-meetspace.vercel.app/my-reservations",
                "Conservez votre référence."
        );

        assertThat(content.html())
                .contains("MeetSpace", "#0f5a4d", "#ff775d", "ROOM-42", "Voir mes réservations")
                .contains("https://tfe-meetspace.vercel.app/my-reservations");
        assertThat(content.text())
                .contains("Réservation confirmée", "Référence : ROOM-42", "Conservez votre référence.");
    }

    @Test
    void escapesAllDynamicHtmlValues() {
        EmailTemplateRenderer.EmailContent content = EmailTemplateRenderer.render(
                "Confirmation <urgente>",
                "Valeur & contrôle",
                null,
                Map.of("Client", "<script>alert('x')</script>"),
                "Ouvrir",
                "https://example.org/?a=1&b=2",
                null
        );

        assertThat(content.html())
                .doesNotContain("<script>")
                .contains("&lt;script&gt;", "Valeur &amp; contrôle", "a=1&amp;b=2");
    }
}
