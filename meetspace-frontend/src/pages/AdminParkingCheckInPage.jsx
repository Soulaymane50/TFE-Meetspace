import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import jsQR from "jsqr";
import WorkspaceNav from "../components/WorkspaceNav";
import { useAuth } from "../context/AuthContext";
import { adminParkingCheckIn } from "../services/api";
import styles from "./OrganizerCheckInPage.module.css";

function normalizePass(value) {
  const cleaned = String(value || "").trim().replace(/[\u200B-\u200D\uFEFF]/g, "");
  if (/^MS-PARKING:/i.test(cleaned)) return `MS-PARKING:${cleaned.slice(11).replace(/[\s-]+/g, "")}`;
  return cleaned.replace(/[\s-]+/g, "");
}

export default function AdminParkingCheckInPage() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [pass, setPass] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const runningRef = useRef(false);
  const lockRef = useRef(false);

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const validatePass = useCallback(async (rawValue) => {
    const value = normalizePass(rawValue);
    if (!value || checking) return;
    setChecking(true);
    setError("");
    setResult(null);
    try {
      const response = await adminParkingCheckIn(value, token);
      setResult(response);
      setPass("");
    } catch (err) {
      setError(err.message || t("parking.invalidAccess", { defaultValue: "Accès parking invalide" }));
    } finally {
      setChecking(false);
    }
  }, [checking, t, token]);

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
        try { detector = new window.BarcodeDetector({ formats: ["qr_code"] }); } catch { detector = null; }
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      runningRef.current = true;
      setCameraActive(true);

      const scan = async () => {
        if (!runningRef.current || !videoRef.current) return;
        try {
          let value = "";
          if (detector) {
            value = (await detector.detect(videoRef.current))[0]?.rawValue || "";
          } else if (videoRef.current.readyState >= 2 && canvasRef.current) {
            const canvas = canvasRef.current;
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const context = canvas.getContext("2d", { willReadFrequently: true });
            context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const frame = context.getImageData(0, 0, canvas.width, canvas.height);
            value = jsQR(frame.data, canvas.width, canvas.height, { inversionAttempts: "attemptBoth" })?.data || "";
          }
          if (value && !lockRef.current) {
            lockRef.current = true;
            stopCamera();
            await validatePass(value);
            lockRef.current = false;
            return;
          }
        } catch { /* Le décodage échoue normalement tant que le QR n'est pas cadré. */ }
        frameRef.current = requestAnimationFrame(scan);
      };
      frameRef.current = requestAnimationFrame(scan);
    } catch {
      stopCamera();
      setCameraMessage(t("checkIn.cameraError"));
    }
  };

  return (
    <div className={styles.page}>
      <WorkspaceNav scope="admin" />
      <header className={styles.header}>
        <div>
          <Link to="/admin/parking" className={styles.back}>← {t("nav.parking")}</Link>
          <p>{t("parking.accessKicker", { defaultValue: "Barrière MeetSpace" })}</p>
          <h1>{t("parking.accessControl", { defaultValue: "Contrôle des accès parking" })}</h1>
          <span>{t("parking.accessControlHelp", { defaultValue: "Chaque QR correspond à un seul véhicule et ne peut être contrôlé qu'une fois." })}</span>
        </div>
      </header>
      <main className={styles.layout}>
        <section className={styles.scanPanel}>
          <div className={styles.sectionHeading}>
            <div><p>{t("checkIn.scanKicker")}</p><h2>{t("parking.scanPass", { defaultValue: "Scanner un laissez-passer" })}</h2></div>
            <span>{t("parking.scanHelp", { defaultValue: "Cadrez le QR du véhicule ou saisissez son code." })}</span>
          </div>
          <div className={styles.cameraFrame} data-active={cameraActive}>
            <video ref={videoRef} muted playsInline />
            <canvas ref={canvasRef} className={styles.scanCanvas} aria-hidden="true" />
            {!cameraActive ? <div><strong>{t("checkIn.cameraReady")}</strong><span>{t("checkIn.cameraReadyHint")}</span></div> : null}
          </div>
          <button type="button" className={styles.cameraButton} onClick={cameraActive ? stopCamera : startCamera}>
            {cameraActive ? t("checkIn.stopCamera") : t("checkIn.startCamera")}
          </button>
          {cameraMessage ? <p className={styles.cameraMessage}>{cameraMessage}</p> : null}
          <div className={styles.separator}><span>{t("checkIn.orManual")}</span></div>
          <form className={styles.manualForm} onSubmit={(event) => { event.preventDefault(); validatePass(pass); }}>
            <label htmlFor="parking-pass">{t("parking.passCode", { defaultValue: "Code du laissez-passer" })}</label>
            <div>
              <input id="parking-pass" value={pass} onChange={(event) => setPass(event.target.value)} autoComplete="off" />
              <button type="submit" disabled={!pass.trim() || checking}>{checking ? t("common.loading") : t("checkIn.validate")}</button>
            </div>
          </form>
          {result ? (
            <div className={`${styles.result} ${result.alreadyUsed ? styles.resultWarning : ""}`} role="status">
              <strong>{result.alreadyUsed ? t("parking.alreadyUsed", { defaultValue: "Accès déjà contrôlé" }) : t("parking.accessGranted", { defaultValue: "Accès autorisé" })}</strong>
              <span>{result.holderName} · {result.sessionTitle}</span>
            </div>
          ) : null}
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </section>
        <section className={styles.attendees}>
          <div className={styles.sectionHeading}>
            <div><p>{t("parking.rulesKicker", { defaultValue: "Règle d'accès" })}</p><h2>{t("parking.oneQrPerVehicle", { defaultValue: "Un véhicule, un QR" })}</h2></div>
          </div>
          <p className={styles.empty}>{t("parking.adminAccessNote", { defaultValue: "Les réservations annulées sont refusées. Un second scan signale immédiatement que le véhicule est déjà entré." })}</p>
        </section>
      </main>
    </div>
  );
}
