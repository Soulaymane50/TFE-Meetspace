import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import PageState from "../components/PageState";
import { useAuth } from "../context/AuthContext";
import { getMyEventRegistrations, getMyParkingReservations, getMyReservations } from "../services/api";
import { formatMoney, normalizeLocale } from "../utils/formatters";
import { formatDate } from "../utils/userActivity";
import styles from "./ReceiptPage.module.css";

const LOADERS = {
  room: getMyReservations,
  event: getMyEventRegistrations,
  parking: getMyParkingReservations,
};

function buildReference(type, id, date) {
  const prefix = { room: "SAL", event: "EVT", parking: "PRK" }[type] || "RES";
  const parsedDate = new Date(date || Date.now());
  const year = Number.isNaN(parsedDate.getTime()) ? new Date().getFullYear() : parsedDate.getFullYear();
  return `MS-${prefix}-${year}-${String(id).padStart(6, "0")}`;
}

function parseDate(value) {
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function formatReceiptDate(value, locale) {
  const parsedDate = parseDate(value);
  return parsedDate ? formatDate(parsedDate, locale, { year: "numeric" }) : "—";
}

function formatReceiptTime(value, locale) {
  const parsedDate = parseDate(value);
  return parsedDate
    ? parsedDate.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
    : "—";
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("copy-failed");
}

export default function ReceiptPage() {
  const { type, id } = useParams();
  const { token, user } = useAuth();
  const { t, i18n } = useTranslation();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const locale = normalizeLocale(i18n.language);
  const loader = LOADERS[type];

  useEffect(() => {
    let cancelled = false;
    if (!loader) return undefined;

    loader(token)
      .then((items) => {
        if (!cancelled) setRecord(items.find((item) => Number(item.id) === Number(id)) || null);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [id, loader, token]);

  const details = useMemo(() => {
    if (!record) return null;
    if (type === "room") {
      return {
        title: record.espace?.name || record.espaceName,
        startsAt: record.startDateTime,
        endsAt: record.endDateTime,
        quantity: t("receipt.roomBooking", { defaultValue: "Location de salle" }),
      };
    }
    if (type === "event") {
      return {
        title: record.eventTitle,
        startsAt: record.eventStartDateTime,
        endsAt: record.eventEndDateTime,
        quantity: t("receipt.participants", { defaultValue: "{{count}} participant(s)", count: record.numberOfParticipants }),
      };
    }
    return {
      title: record.parkingSlotTitle,
      startsAt: `${record.slotDate}T${record.startTime}`,
      endsAt: `${record.slotDate}T${record.endTime}`,
      quantity: t("receipt.parkingSpaces", { defaultValue: "{{count}} place(s)", count: record.reservedSpaces }),
    };
  }, [record, t, type]);

  const ticketPayload = useMemo(() => {
    if (type !== "event" || !record?.ticketToken) return "";
    return `MS-CHECKIN:${record.eventId}:${record.ticketToken}`;
  }, [record, type]);

  useEffect(() => {
    let cancelled = false;
    if (!ticketPayload) return undefined;
    QRCode.toDataURL(ticketPayload, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0d3b33", light: "#fffdf8" },
    }).then((dataUrl) => !cancelled && setQrCode(dataUrl));
    return () => { cancelled = true; };
  }, [ticketPayload]);

  const copyTicket = async () => {
    try {
      await copyText(record.ticketToken);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
    window.setTimeout(() => setCopyStatus(""), 2400);
  };

  if (!loader) return <PageState type="error" title={t("receipt.notFound", { defaultValue: "Justificatif introuvable" })} message={t("receipt.notFoundHint", { defaultValue: "Cette réservation n’existe pas dans votre compte." })} action={<Link to="/my-reservations">{t("common.back", { defaultValue: "Retour" })}</Link>} />;
  if (loading) return <PageState type="loading" title={t("common.loading")} message={t("receipt.title", { defaultValue: "Justificatif" })} />;
  if (error || !record || !details) return <PageState type="error" title={t("receipt.notFound", { defaultValue: "Justificatif introuvable" })} message={error || t("receipt.notFoundHint", { defaultValue: "Cette réservation n’existe pas dans votre compte." })} action={<Link to="/my-reservations">{t("common.back", { defaultValue: "Retour" })}</Link>} />;

  const reference = buildReference(type, record.id, record.createdAt || details.startsAt);
  return (
    <div className={styles.page}>
      <nav className={styles.screenActions} aria-label={t("receipt.actions", { defaultValue: "Actions du justificatif" })}>
        <Link to="/my-reservations">← {t("nav.myReservations")}</Link>
        <button type="button" onClick={() => window.print()}>{t("receipt.print", { defaultValue: "Imprimer ou enregistrer en PDF" })}</button>
      </nav>

      <article className={styles.document}>
        <header className={styles.brandHeader}>
          <div className={styles.mark}>M</div>
          <div><strong>MeetSpace</strong><span>Salles, événements & parking</span></div>
          <p>{t("receipt.documentType", { defaultValue: "Justificatif de réservation" })}</p>
        </header>

        <section className={styles.identity}>
          <div><span>{t("receipt.reference", { defaultValue: "Référence" })}</span><strong>{reference}</strong></div>
          <div><span>{t("receipt.customer", { defaultValue: "Client" })}</span><strong>{user?.firstName} {user?.lastName}</strong><small>{user?.email}</small></div>
          <div><span>{t("receipt.issueDate", { defaultValue: "Émis le" })}</span><strong>{formatDate(new Date(), locale)}</strong></div>
        </section>

        <section className={styles.booking}>
          <p>{t("receipt.booking", { defaultValue: "Réservation" })}</p>
          <h1>{details.title}</h1>
          <dl>
            <div><dt>{t("common.date")}</dt><dd>{formatReceiptDate(details.startsAt, locale)}</dd></div>
            <div><dt>{t("common.time")}</dt><dd>{formatReceiptTime(details.startsAt, locale)} — {formatReceiptTime(details.endsAt, locale)}</dd></div>
            <div><dt>{t("common.status", { defaultValue: "Statut" })}</dt><dd>{t(`status.${String(record.status).toLowerCase()}`, { defaultValue: record.status })}</dd></div>
          </dl>
        </section>

        {type === "event" && record.ticketToken ? (
          <section className={styles.ticket} aria-labelledby="event-ticket-title">
            <div className={styles.ticketCopy}>
              <p>{t("checkIn.ticketKicker")}</p>
              <h2 id="event-ticket-title">{t("checkIn.ticketTitle")}</h2>
              <span>{t("checkIn.ticketHelp")}</span>
              {record.checkedInAt ? (
                <strong className={styles.checkedStatus}>
                  {t("checkIn.checkedAt", { date: formatReceiptDate(record.checkedInAt, locale), time: formatReceiptTime(record.checkedInAt, locale) })}
                </strong>
              ) : null}
              <div className={styles.ticketCode}>
                <small>{t("checkIn.ticketCode")}</small>
                <code>{record.ticketToken.match(/.{1,4}/g)?.join(" ") || record.ticketToken}</code>
                <button type="button" onClick={copyTicket}>{copyStatus === "copied" ? t("checkIn.copied") : t("checkIn.copyCode")}</button>
                {copyStatus === "error" ? (
                  <span className={styles.copyError} role="status">{t("checkIn.copyFailed")}</span>
                ) : null}
              </div>
            </div>
            <div className={styles.qrPanel}>
              {qrCode ? <img src={qrCode} alt={t("checkIn.qrAlt", { event: details.title })} /> : <span>{t("common.loading")}</span>}
              <small>{t("checkIn.presentQr")}</small>
            </div>
          </section>
        ) : null}

        <section className={styles.amountLine}>
          <div><span>{details.quantity}</span><small>{t("receipt.serviceDeliveredBy", { defaultValue: "Service MeetSpace Brussels" })}</small></div>
          <strong>{formatMoney(record.totalPrice || 0, locale)}</strong>
        </section>

        <footer className={styles.footer}>
          <p>{t("receipt.disclaimer", { defaultValue: "Ce document confirme la réservation enregistrée dans MeetSpace. Il ne constitue pas une facture comptable ou fiscale." })}</p>
          <span>MeetSpace · Bruxelles · {reference}</span>
        </footer>
      </article>
    </div>
  );
}
