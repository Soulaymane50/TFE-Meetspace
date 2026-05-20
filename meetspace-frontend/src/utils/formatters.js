const LOCALE_MAP = {
  fr: "fr-BE",
  en: "en-GB",
  nl: "nl-BE",
};

export function normalizeLocale(language) {
  const key = String(language || "fr").slice(0, 2).toLowerCase();
  return LOCALE_MAP[key] || "fr-BE";
}

export function formatNumber(value, locale = "fr-BE", options = {}) {
  const number = Number(value ?? 0);
  const safeNumber = Number.isFinite(number) ? number : 0;

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    ...options,
  })
    .format(safeNumber)
    .replace(/[\u00a0\u202f]/g, " ");
}

export function formatMoney(value, locale = "fr-BE", options = {}) {
  return `${formatNumber(value, locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  })} \u20ac`;
}
