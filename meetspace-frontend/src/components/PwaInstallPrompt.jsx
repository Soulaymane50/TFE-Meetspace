import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./PwaInstallPrompt.module.css";

const DISMISS_KEY = "meetspace-install-dismissed";

export default function PwaInstallPrompt() {
  const { t } = useTranslation();
  const [installEvent, setInstallEvent] = useState(null);

  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault();
      if (!sessionStorage.getItem(DISMISS_KEY)) setInstallEvent(event);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!installEvent) return null;

  const install = async () => {
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setInstallEvent(null);
  };

  return (
    <aside className={styles.prompt} aria-label={t("pwa.title")}>
      <span className={styles.rule} aria-hidden="true" />
      <div>
        <strong>{t("pwa.title")}</strong>
        <span>{t("pwa.message")}</span>
      </div>
      <button type="button" className={styles.install} onClick={install}>{t("pwa.install")}</button>
      <button type="button" className={styles.dismiss} onClick={dismiss} aria-label={t("pwa.dismiss")}>×</button>
    </aside>
  );
}
