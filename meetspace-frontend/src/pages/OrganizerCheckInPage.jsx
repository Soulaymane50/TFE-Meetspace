import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import jsQR from "jsqr";
import PageState from "../components/PageState";
import WorkspaceNav from "../components/WorkspaceNav";
import { useAuth } from "../context/AuthContext";
import { organizerCheckIn, organizerGetEventAttendees, organizerGetMyEvent } from "../services/api";
import { normalizeLocale } from "../utils/formatters";
import styles from "./OrganizerCheckInPage.module.css";

function participantTotal(rows) {
  return rows.reduce((total, row) => total + (Number(row.numberOfParticipants) || 0), 0);
}

function normalizeTicketValue(rawTicket) {
  const value = String(rawTicket || "").trim().replace(/[\u200B-\u200D\uFEFF]/g, "");
  const payload = value.match(/^MS-CHECKIN:(\d+):(.+)$/i);
  if (payload) {
    return `MS-CHECKIN:${payload[1]}:${payload[2].replace(/[\s-]+/g, "")}`;
  }
  return value.replace(/[\s-]+/g, "");
}

export default function OrganizerCheckInPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const [event, setEvent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [search, setSearch] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const cameraRunningRef = useRef(false);
  const scanLockRef = useRef(false);
  const locale = normalizeLocale(i18n.language);

  const loadData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError("");
    try {
      const [eventData, attendeeData] = await Promise.all([
        organizerGetMyEvent(id, token),
        organizerGetEventAttendees(id, token),
      ]);
      setEvent(eventData);
      setAttendees(attendeeData);
    } catch (err) {
      setError(err.message);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [id, token]);

  useEffect(() => { loadData(); }, [loadData]);

  const stopCamera = useCallback(() => {
    cameraRunningRef.current = false;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const validateTicket = useCallback(async (rawTicket) => {
    const value = normalizeTicketValue(rawTicket);
    if (!value || checking) return;
    setChecking(true);
    setError("");
    try {
      const response = await organizerCheckIn(id, value, token);
      setResult(response);
      setTicket("");
      setAttendees((current) => current.map((row) => (
        Number(row.id) === Number(response.registrationId)
          ? { ...row, checkedInAt: response.checkedInAt }
          : row
      )));
    } catch (err) {
      setResult(null);
      setError(err.message || t("checkIn.invalidTicket"));
    } finally {
      setChecking(false);
    }
  }, [checking, id, t, token]);

  const startCamera = async () => {
    setCameraMessage("");
    setResult(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage(t("checkIn.cameraUnsupported"));
      return;
    }

    try {
      let detector = null;
      if ("BarcodeDetector" in window) {
        try {
          const supported = await window.BarcodeDetector.getSupportedFormats?.();
          if (!supported || supported.includes("qr_code")) {
            detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          }
        } catch {
          detector = null;
        }
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      cameraRunningRef.current = true;
      setCameraActive(true);

      const scanFrame = async () => {
        if (!cameraRunningRef.current || !videoRef.current) return;
        try {
          let value = "";
          if (detector) {
            const codes = await detector.detect(videoRef.current);
            value = codes[0]?.rawValue || "";
          } else if (videoRef.current.readyState >= 2 && canvasRef.current) {
            const canvas = canvasRef.current;
            const width = videoRef.current.videoWidth;
            const height = videoRef.current.videoHeight;
            if (width > 0 && height > 0) {
              canvas.width = width;
              canvas.height = height;
              const context = canvas.getContext("2d", { willReadFrequently: true });
              if (context) {
                context.drawImage(videoRef.current, 0, 0, width, height);
                const frame = context.getImageData(0, 0, width, height);
                value = jsQR(frame.data, width, height, { inversionAttempts: "attemptBoth" })?.data || "";
              }
            }
          }
          if (value && !scanLockRef.current) {
            scanLockRef.current = true;
            stopCamera();
            await validateTicket(value);
            scanLockRef.current = false;
            return;
          }
        } catch {
          // A decoding miss is expected while the camera is moving.
        }
        frameRef.current = requestAnimationFrame(scanFrame);
      };
      frameRef.current = requestAnimationFrame(scanFrame);
    } catch {
      stopCamera();
      setCameraMessage(t("checkIn.cameraError"));
    }
  };

  const confirmedAttendees = useMemo(
    () => attendees.filter((row) => row.status === "CONFIRMED"),
    [attendees],
  );
  const checkedAttendees = useMemo(
    () => confirmedAttendees.filter((row) => row.checkedInAt),
    [confirmedAttendees],
  );
  const visibleAttendees = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(locale);
    return [...attendees]
      .filter((row) => !query || `${row.userName} ${row.userEmail}`.toLocaleLowerCase(locale).includes(query))
      .sort((a, b) => Number(Boolean(a.checkedInAt)) - Number(Boolean(b.checkedInAt)) || a.userName.localeCompare(b.userName, locale));
  }, [attendees, locale, search]);
  const expected = participantTotal(confirmedAttendees);
  const checked = participantTotal(checkedAttendees);

  if (loading) return <PageState type="loading" title={t("checkIn.loadingTitle")} message={t("checkIn.loadingMessage")} />;
  if (!event) return <PageState type="error" title={t("checkIn.unavailableTitle")} message={error || t("checkIn.unavailableMessage")} action={<Link to="/organizer/events">{t("checkIn.back")}</Link>} />;

  return (
    <div className={styles.page}>
      <WorkspaceNav scope="organizer" />
      <header className={styles.header}>
        <div>
          <Link to="/organizer/events" className={styles.back}>← {t("checkIn.back")}</Link>
          <p>{t("checkIn.eyebrow")}</p>
          <h1>{event.title}</h1>
          <span>{new Date(event.startDateTime).toLocaleString(locale, { dateStyle: "full", timeStyle: "short" })} · {event.location}</span>
        </div>
        <dl className={styles.stats}>
          <div><dt>{t("checkIn.expected")}</dt><dd>{expected}</dd></div>
          <div><dt>{t("checkIn.checkedIn")}</dt><dd>{checked}</dd></div>
          <div><dt>{t("checkIn.remaining")}</dt><dd>{Math.max(expected - checked, 0)}</dd></div>
        </dl>
      </header>

      <main className={styles.layout}>
        <section className={styles.scanPanel}>
          <div className={styles.sectionHeading}>
            <div><p>{t("checkIn.scanKicker")}</p><h2>{t("checkIn.scanTitle")}</h2></div>
            <span>{t("checkIn.scanHelp")}</span>
          </div>

          <div className={styles.cameraFrame} data-active={cameraActive}>
            <video ref={videoRef} muted playsInline aria-label={t("checkIn.cameraPreview")} />
            <canvas ref={canvasRef} className={styles.scanCanvas} aria-hidden="true" />
            {!cameraActive ? <div><strong>{t("checkIn.cameraReady")}</strong><span>{t("checkIn.cameraReadyHint")}</span></div> : null}
          </div>
          <button type="button" className={styles.cameraButton} onClick={cameraActive ? stopCamera : startCamera}>
            {cameraActive ? t("checkIn.stopCamera") : t("checkIn.startCamera")}
          </button>
          {cameraMessage ? <p className={styles.cameraMessage}>{cameraMessage}</p> : null}

          <div className={styles.separator}><span>{t("checkIn.orManual")}</span></div>
          <form className={styles.manualForm} onSubmit={(e) => { e.preventDefault(); validateTicket(ticket); }}>
            <label htmlFor="ticket-code">{t("checkIn.manualLabel")}</label>
            <div>
              <input id="ticket-code" value={ticket} onChange={(e) => setTicket(e.target.value)} placeholder={t("checkIn.manualPlaceholder")} autoComplete="off" />
              <button type="submit" disabled={!ticket.trim() || checking}>{checking ? t("common.loading") : t("checkIn.validate")}</button>
            </div>
          </form>

          {result ? (
            <div className={`${styles.result} ${result.alreadyCheckedIn ? styles.resultWarning : ""}`} role="status">
              <strong>{result.alreadyCheckedIn ? t("checkIn.alreadyCheckedIn") : t("checkIn.validTicket")}</strong>
              <span>{result.attendeeName} · {t("checkIn.participants", { count: result.numberOfParticipants })}</span>
            </div>
          ) : null}
          {error ? <div className={styles.error} role="alert">{error}</div> : null}
        </section>

        <section className={styles.attendees}>
          <div className={styles.sectionHeading}>
            <div><p>{t("checkIn.listKicker")}</p><h2>{t("checkIn.attendeeList")}</h2></div>
            <span>{checkedAttendees.length} / {confirmedAttendees.length}</span>
          </div>
          <label className={styles.search}>
            <span>{t("checkIn.searchLabel")}</span>
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("checkIn.search")} />
          </label>
          {visibleAttendees.length ? (
            <ul className={styles.attendeeList}>
              {visibleAttendees.map((row) => (
                <li key={row.id}>
                  <div><strong>{row.userName}</strong><span>{row.userEmail} · {t("checkIn.participants", { count: row.numberOfParticipants })}</span></div>
                  <span className={row.checkedInAt ? styles.present : row.status === "CONFIRMED" ? styles.waiting : styles.cancelled}>
                    {row.checkedInAt ? t("checkIn.present") : row.status === "CONFIRMED" ? t("checkIn.notCheckedIn") : t("checkIn.cancelled")}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className={styles.empty}>{t("checkIn.noAttendees")}</p>}
        </section>
      </main>
    </div>
  );
}
