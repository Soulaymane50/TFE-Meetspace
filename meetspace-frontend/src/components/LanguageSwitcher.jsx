import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import styles from "./LanguageSwitcher.module.css";

const languages = ["fr", "en", "nl"];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const getCurrentLang = () => {
    const lang = i18n.resolvedLanguage || i18n.language;
    if (lang?.startsWith("fr")) return "fr";
    if (lang?.startsWith("nl")) return "nl";
    return "en";
  };

  const currentLang = getCurrentLang();

  useEffect(() => {
    document.documentElement.lang = { fr: "fr-BE", en: "en-GB", nl: "nl-BE" }[currentLang];
  }, [currentLang]);

  return (
    <div className={styles.switcher}>
      {languages.map((lang) => (
        <button
          key={lang}
          type="button"
          aria-pressed={currentLang === lang}
          onClick={() => i18n.changeLanguage(lang)}
          className={`${styles.btn} ${currentLang === lang ? styles.active : ""}`}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
