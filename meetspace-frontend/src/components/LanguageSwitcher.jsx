import { useTranslation } from "react-i18next";
import styles from "./LanguageSwitcher.module.css";

const languages = ["fr", "en", "nl"];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const getCurrentLang = () => {
    const lang = i18n.language;
    if (lang?.startsWith("fr")) return "fr";
    if (lang?.startsWith("nl")) return "nl";
    return "en";
  };

  const currentLang = getCurrentLang();

  return (
    <div className={styles.switcher}>
      {languages.map((lang) => (
        <button
          key={lang}
          onClick={() => i18n.changeLanguage(lang)}
          className={`${styles.btn} ${currentLang === lang ? styles.active : ""}`}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
