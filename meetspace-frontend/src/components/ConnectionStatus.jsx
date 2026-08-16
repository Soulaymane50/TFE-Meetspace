import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./ConnectionStatus.module.css";

const API_URL = import.meta.env.VITE_API_URL || "";

async function probeApi() {
  if (!API_URL || !navigator.onLine) return navigator.onLine;
  try {
    const response = await fetch(API_URL + "/actuator/health", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

function getInitialStatus() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  return "ready";
}

export default function ConnectionStatus() {
  const { t } = useTranslation();
  const [status, setStatus] = useState(getInitialStatus);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let active = true;
    const handleOffline = () => setStatus("offline");
    const handleOnline = async () => {
      const available = await probeApi();
      if (active) setStatus(available ? "ready" : "api-unavailable");
    };
    const handleApiUnavailable = () => setStatus("api-unavailable");
    const handleApiRecovered = () => setStatus("ready");

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    window.addEventListener("meetspace:api-unavailable", handleApiUnavailable);
    window.addEventListener("meetspace:api-recovered", handleApiRecovered);
    handleOnline();
    return () => {
      active = false;
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("meetspace:api-unavailable", handleApiUnavailable);
      window.removeEventListener("meetspace:api-recovered", handleApiRecovered);
    };
  }, []);

  const retry = async () => {
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }

    setRetrying(true);
    try {
      const response = await fetch(`${API_URL}/actuator/health`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      setStatus(response.ok ? "ready" : "api-unavailable");
    } catch {
      setStatus("api-unavailable");
    } finally {
      setRetrying(false);
    }
  };

  if (status === "ready") return null;

  const offline = status === "offline";
  return (
    <section className={styles.banner} role="status" aria-live="polite">
      <span className={styles.marker} aria-hidden="true" />
      <div>
        <strong>
          {offline
            ? t("system.offlineTitle", { defaultValue: "Vous êtes hors connexion" })
            : t("system.apiUnavailableTitle", { defaultValue: "Service momentanément indisponible" })}
        </strong>
        <span>
          {offline
            ? t("system.offlineMessage", { defaultValue: "Les pages déjà ouvertes restent consultables. Les actions seront disponibles au retour du réseau." })
            : t("system.apiUnavailableMessage", { defaultValue: "Le catalogue peut rester visible, mais les réservations et le compte nécessitent le service MeetSpace." })}
        </span>
      </div>
      <button type="button" onClick={retry} disabled={retrying}>
        {retrying
          ? t("common.checking", { defaultValue: "Vérification…" })
          : t("common.retry", { defaultValue: "Réessayer" })}
      </button>
    </section>
  );
}
