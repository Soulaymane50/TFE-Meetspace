package be.meetspace.service;

import org.springframework.util.StringUtils;

import java.util.Map;

final class EmailTemplateRenderer {

    private static final String FONT_STACK = "Arial, 'Helvetica Neue', Helvetica, sans-serif";

    private EmailTemplateRenderer() {
    }

    static EmailContent render(String title,
                               String intro,
                               String greeting,
                               Map<String, String> details,
                               String actionLabel,
                               String actionUrl,
                               String notice) {
        Map<String, String> safeDetails = details == null ? Map.of() : details;
        String plainText = buildText(title, intro, greeting, safeDetails, actionLabel, actionUrl, notice);
        String html = buildHtml(title, intro, greeting, safeDetails, actionLabel, actionUrl, notice);
        return new EmailContent(plainText, html);
    }

    private static String buildText(String title,
                                    String intro,
                                    String greeting,
                                    Map<String, String> details,
                                    String actionLabel,
                                    String actionUrl,
                                    String notice) {
        StringBuilder builder = new StringBuilder("MeetSpace\nSalles, événements & parking\n\n");
        if (StringUtils.hasText(greeting)) {
            builder.append(greeting).append("\n\n");
        }
        builder.append(title).append("\n").append(intro).append("\n\n");
        details.forEach((label, value) -> builder
                .append(label)
                .append(" : ")
                .append(value)
                .append("\n"));
        if (!details.isEmpty()) {
            builder.append("\n");
        }
        if (StringUtils.hasText(actionLabel) && StringUtils.hasText(actionUrl)) {
            builder.append(actionLabel).append(" :\n").append(actionUrl).append("\n\n");
        }
        if (StringUtils.hasText(notice)) {
            builder.append(notice).append("\n\n");
        }
        return builder.append("Besoin d'aide ? Répondez à cet e-mail ou contactez l'équipe MeetSpace.\n\n")
                .append("MeetSpace — Bruxelles")
                .toString();
    }

    private static String buildHtml(String title,
                                    String intro,
                                    String greeting,
                                    Map<String, String> details,
                                    String actionLabel,
                                    String actionUrl,
                                    String notice) {
        StringBuilder detailRows = new StringBuilder();
        details.forEach((label, value) -> detailRows.append("""
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #d9ded9;color:#5c6964;font-size:14px;line-height:20px;vertical-align:top;">%s</td>
                  <td style="padding:12px 0 12px 20px;border-bottom:1px solid #d9ded9;color:#142720;font-size:14px;font-weight:700;line-height:20px;text-align:right;vertical-align:top;">%s</td>
                </tr>
                """.formatted(escapeHtml(label), escapeHtml(value))));

        String greetingBlock = StringUtils.hasText(greeting)
                ? "<p style=\"margin:0 0 14px;color:#5c6964;font-size:15px;line-height:24px;\">" + escapeHtml(greeting) + "</p>"
                : "";
        String detailsBlock = detailRows.isEmpty()
                ? ""
                : "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"margin:24px 0 0;border-collapse:collapse;\">"
                + detailRows + "</table>";
        String actionBlock = StringUtils.hasText(actionLabel) && StringUtils.hasText(actionUrl)
                ? """
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px 0 0;">
                    <tr>
                      <td style="background:#0f5a4d;border-bottom:3px solid #ff775d;">
                        <a href="%s" style="display:inline-block;padding:13px 20px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">%s</a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:14px 0 0;color:#74807b;font-size:12px;line-height:18px;word-break:break-all;">Si le bouton ne fonctionne pas, copiez ce lien :<br><a href="%s" style="color:#0f5a4d;">%s</a></p>
                """.formatted(escapeHtml(actionUrl), escapeHtml(actionLabel), escapeHtml(actionUrl), escapeHtml(actionUrl))
                : "";
        String noticeBlock = StringUtils.hasText(notice)
                ? "<div style=\"margin:24px 0 0;padding:14px 16px;border-left:3px solid #ff775d;background:#fbf2ed;color:#554d49;font-size:13px;line-height:20px;\">"
                + escapeHtml(notice) + "</div>"
                : "";

        return """
                <!doctype html>
                <html lang="fr">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>%s</title>
                </head>
                <body style="margin:0;padding:0;background:#f3f0e9;font-family:%s;color:#142720;">
                  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">%s</div>
                  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="width:100%%;background:#f3f0e9;">
                    <tr>
                      <td align="center" style="padding:28px 12px;">
                        <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:100%%;max-width:620px;background:#fffdfa;border-collapse:collapse;border:1px solid #d9ded9;">
                          <tr>
                            <td style="padding:0;background:#0d3f36;height:6px;font-size:0;line-height:0;"><span style="display:inline-block;width:112px;height:6px;background:#ff775d;"></span></td>
                          </tr>
                          <tr>
                            <td style="padding:24px 30px 20px;border-bottom:1px solid #d9ded9;">
                              <table role="presentation" width="100%%" cellspacing="0" cellpadding="0">
                                <tr>
                                  <td style="width:46px;vertical-align:middle;">
                                    <div style="width:40px;height:40px;background:#0f5a4d;color:#ffffff;font-family:Georgia,serif;font-size:23px;font-weight:700;line-height:40px;text-align:center;">M</div>
                                  </td>
                                  <td style="vertical-align:middle;">
                                    <div style="font-family:Georgia,serif;color:#142720;font-size:22px;font-weight:700;line-height:24px;">MeetSpace</div>
                                    <div style="margin-top:3px;color:#68736f;font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">Salles, événements &amp; parking</div>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:34px 30px 30px;">
                              %s
                              <div style="margin:0 0 10px;color:#0f5a4d;font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">Votre espace MeetSpace</div>
                              <h1 style="margin:0;color:#142720;font-family:Georgia,serif;font-size:30px;font-weight:700;line-height:36px;">%s</h1>
                              <p style="margin:15px 0 0;color:#50605a;font-size:15px;line-height:24px;">%s</p>
                              %s
                              %s
                              %s
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:20px 30px;background:#0d3f36;color:#dce7e3;font-size:12px;line-height:19px;">
                              <strong style="color:#ffffff;">MeetSpace</strong><br>
                              Réservez vos salles, événements et places de parking depuis un seul espace.<br>
                              <span style="color:#aebdb8;">Bruxelles · Message transactionnel automatique</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """.formatted(
                escapeHtml(title),
                FONT_STACK,
                escapeHtml(intro),
                greetingBlock,
                escapeHtml(title),
                escapeHtml(intro),
                detailsBlock,
                actionBlock,
                noticeBlock
        );
    }

    static String escapeHtml(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    record EmailContent(String text, String html) {
    }
}
