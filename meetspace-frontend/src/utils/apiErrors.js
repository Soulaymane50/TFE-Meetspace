export function apiErrorMessage(message, status, t) {
  if (message === "REQUEST_TIMEOUT") return t("system.requestTimeout");
  if (message === "WRITE_OUTCOME_UNKNOWN") return t("system.writeOutcomeUnknown");
  if (status >= 500 || typeof message !== "string" || !message.trim() ||
    /^[A-Z][A-Z0-9_]+$/.test(message) || /<\/?(?:html|!doctype)|stacktrace|java\.|Exception|Failed to fetch|NetworkError|fetch failed/i.test(message)) {
    return t("system.requestFailed");
  }
  return message;
}
