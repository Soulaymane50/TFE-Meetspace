import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getEventSettlements, recordEventPayout } from "../services/api";
import { formatMoney, normalizeLocale } from "../utils/formatters";
import { useFeedback } from "../context/FeedbackContext";
import styles from "./EventSettlements.module.css";

export default function EventSettlements({ token, admin = false }) {
  const { t, i18n } = useTranslation();
  const { confirm, notify } = useFeedback();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [reference, setReference] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [limit, setLimit] = useState(8);
  const busy = useRef(false);
  const generation = useRef(0);
  const locale = normalizeLocale(i18n.resolvedLanguage || i18n.language);
  const money = (cents) => formatMoney(Number(cents || 0) / 100, locale);
  const date = (value) => value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const result = await getEventSettlements(token, admin);
      if (generation.current === current) setRows(result);
    } catch (err) {
      if (generation.current === current) setError(err.message);
    } finally {
      if (generation.current === current) setLoading(false);
    }
  }, [token, admin]);
  useEffect(() => {
    const counter = generation;
    load();
    return () => { counter.current++; };
  }, [load]);

  const submit = async (event) => {
    event.preventDefault();
    if (!selected || !acknowledged || busy.current) return;
    const row = selected;
    const transferReference = reference.trim();
    busy.current = true;
    setSaving(true);
    try {
      const accepted = await confirm({ title: t("settlement.confirmTitle"),
        message: t("settlement.confirmMessage", { amount: money(row.amountCents), title: row.eventTitle }),
        confirmLabel: t("settlement.confirmRecord"), cancelLabel: t("common.cancel") });
      if (!accepted) return;
      const result = await recordEventPayout(row.eventId, transferReference, row.amountCents, token);
      setRows((current) => current.map((item) => item.eventId === result.eventId ? result : item));
      setSelected(null);
      setReference("");
      setAcknowledged(false);
      notify({ type: "success", title: t("settlement.saved") });
    } catch (err) {
      setError(err.message);
      await load();
      setError(err.message);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  // Finished events come first; upcoming events remain accessible without a wall of rows.
  const sorted = [...rows].sort((a, b) => {
    const waitingA = a.status === "HOLDING_REVENUE" ? 1 : 0;
    const waitingB = b.status === "HOLDING_REVENUE" ? 1 : 0;
    return waitingA - waitingB || new Date(b.eventEndsAt) - new Date(a.eventEndsAt);
  });
  return (
    <section className={styles.panel} aria-labelledby={admin ? "admin-settlements" : "organizer-settlements"} data-testid="event-settlements">
      <header className={styles.heading}>
        <div><h2 id={admin ? "admin-settlements" : "organizer-settlements"}>{t(admin ? "settlement.title" : "settlement.organizerTitle")}</h2><p>{t(admin ? "settlement.adminHelp" : "settlement.organizerHelp")}</p></div>
        <button type="button" onClick={load} disabled={loading || saving}>{t("settlement.refresh")}</button>
      </header>
      {loading && <p role="status">{t("settlement.loading")}</p>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {!loading && !error && !rows.length && <p>{t("settlement.empty")}</p>}
      <div className={styles.rows}>
        {sorted.slice(0, limit).map((row) => (
          <article className={styles.row} key={row.eventId}>
            <div className={styles.identity}><h3>{row.eventTitle}</h3>{admin && <p>{row.organizerName}{row.organizerEmail && <> · {row.organizerEmail}</>}</p>}<small>{t("settlement.eventEnded", { date: date(row.eventEndsAt) })}</small></div>
            <div className={styles.state}><strong>{money(row.amountCents)}</strong><span>{t(row.status === "READY_FOR_PAYOUT" ? (admin ? "settlement.readyAdmin" : "settlement.readyOrganizer") : "settlement.status." + row.status)}</span></div>
            <dl className={styles.breakdown}>
              <div><dt>{t("settlement.tickets")}</dt><dd>{money(row.ticketRevenueCents)}</dd></div>
              <div><dt>{t("settlement.commission")}</dt><dd>− {money(row.commissionCents)}</dd></div>
              {row.roomBalanceDeductedCents > 0 && <div><dt>{t("settlement.legacyBalance")}</dt><dd>− {money(row.roomBalanceDeductedCents)}</dd></div>}
            </dl>
            {row.status === "HOLDING_REVENUE" && <p>{t("settlement.due", { date: date(row.dueAt) })}</p>}
            {row.status === "PAYMENT_PENDING" && <p>{t("settlement.paymentPendingHelp")}</p>}
            {row.status === "REFUND_PENDING" && <p>{t("settlement.pendingHelp")}</p>}
            {row.status === "BENEFICIARY_UNAVAILABLE" && <p>{t("settlement.beneficiaryHelp")}</p>}
            {row.status === "REVIEW_REQUIRED" && <p>{t("settlement.reviewHelp")}</p>}
            {row.status === "PAID" && <p>{t("settlement.recorded", { date: date(row.recordedAt), reference: row.transferReference })}</p>}
            {admin && row.status === "READY_FOR_PAYOUT" && selected?.eventId !== row.eventId && <button type="button" disabled={saving} onClick={() => { setSelected(row); setReference(""); setAcknowledged(false); setError(""); }}>{t("settlement.openRecord")}</button>}
            {admin && row.status === "READY_FOR_PAYOUT" && selected?.eventId === row.eventId && <form onSubmit={submit} className={styles.form}>
              <p>{t("settlement.manualNotice")}</p>
              <label>{t("settlement.reference")}<input required minLength={3} maxLength={120} value={reference} onChange={(event) => setReference(event.target.value)} disabled={saving} autoFocus /></label>
              <label className={styles.checkbox}><input type="checkbox" required checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} disabled={saving} />{t("settlement.acknowledge")}</label>
              <div className={styles.actions}><button type="submit" disabled={!acknowledged || saving}>{t(saving ? "settlement.saving" : "settlement.confirmRecord")}</button><button type="button" disabled={saving} onClick={() => setSelected(null)}>{t("common.cancel")}</button></div>
            </form>}
          </article>
        ))}
      </div>
      {rows.length > limit && <button type="button" className={styles.more} onClick={() => setLimit((current) => current + 8)}>{t("settlement.showMore")}</button>}
    </section>
  );
}
