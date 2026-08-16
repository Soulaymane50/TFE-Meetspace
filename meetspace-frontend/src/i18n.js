import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import fr from './locales/fr.json';
import en from './locales/en.json';
import nl from './locales/nl.json';
import enhancements from './locales/enhancements';

function mergeTranslations(base, extra) {
  return Object.entries(extra).reduce((result, [key, value]) => {
    const nested = value && typeof value === 'object' && !Array.isArray(value);
    result[key] = nested ? mergeTranslations(base[key] || {}, value) : value;
    return result;
  }, { ...base });
}

const resources = {
  fr: { translation: mergeTranslations(fr, enhancements.fr) },
  en: { translation: mergeTranslations(en, enhancements.en) },
  nl: { translation: mergeTranslations(nl, enhancements.nl) },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
