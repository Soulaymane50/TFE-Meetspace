import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { sendSupportContactRequest } from "../services/api";
import styles from "./ContactPage.module.css";

const initialForm = {
  name: "",
  email: "",
  category: "account",
  subject: "",
  message: "",
  reservationReference: "",
};

export default function ContactPage() {
  const { t } = useTranslation();
  const { user, token } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const categories = useMemo(() => [
    "account",
    "room_reservation",
    "event",
    "parking",
    "payment",
    "other",
  ], []);

  useEffect(() => {
    if (!user) return;
    const displayName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    setForm((current) => ({
      ...current,
      name: current.name || displayName,
      email: current.email || user.email || "",
    }));
  }, [user]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const validate = () => {
    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      return t("support.errors.required");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return t("support.errors.email");
    }
    if (form.message.trim().length < 10) {
      return t("support.errors.messageShort");
    }
    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      await sendSupportContactRequest(form, token);
      setSuccess(t("support.success"));
      setForm((current) => ({
        ...initialForm,
        name: current.name,
        email: current.email,
      }));
    } catch {
      setError(t("support.errors.generic"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{t("support.kicker")}</p>
          <h1>{t("support.title")}</h1>
          <p>{t("support.intro")}</p>
        </div>
        <aside className={styles.sidePanel}>
          <span>{t("support.responseLabel")}</span>
          <strong>{t("support.responseTitle")}</strong>
          <p>{t("support.responseText")}</p>
        </aside>
      </section>

      <section className={styles.contentGrid}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formHeader}>
            <p className={styles.kicker}>{t("support.formKicker")}</p>
            <h2>{t("support.formTitle")}</h2>
          </div>

          <div className={styles.twoColumns}>
            <label className={styles.field}>
              <span>{t("support.name")}</span>
              <input
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                maxLength={120}
                required
              />
            </label>

            <label className={styles.field}>
              <span>{t("support.email")}</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                maxLength={180}
                required
              />
            </label>
          </div>

          <label className={styles.field}>
            <span>{t("support.category")}</span>
            <select
              value={form.category}
              onChange={(event) => updateField("category", event.target.value)}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {t(`support.categories.${category}`)}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>{t("support.subject")}</span>
            <input
              value={form.subject}
              onChange={(event) => updateField("subject", event.target.value)}
              maxLength={160}
              required
            />
          </label>

          <label className={styles.field}>
            <span>{t("support.message")}</span>
            <textarea
              value={form.message}
              onChange={(event) => updateField("message", event.target.value)}
              maxLength={3000}
              rows={7}
              required
            />
          </label>

          <label className={styles.field}>
            <span>{t("support.reference")}</span>
            <input
              value={form.reservationReference}
              onChange={(event) => updateField("reservationReference", event.target.value)}
              maxLength={120}
              placeholder={t("support.referencePlaceholder")}
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>{success}</p>}

          <button type="submit" disabled={loading}>
            {loading ? t("common.loading") : t("support.submit")}
          </button>
        </form>

        <aside className={styles.helpCard}>
          <p className={styles.kicker}>{t("support.helpKicker")}</p>
          <h2>{t("support.helpTitle")}</h2>
          <ul>
            <li>{t("support.helpItemAccount")}</li>
            <li>{t("support.helpItemBooking")}</li>
            <li>{t("support.helpItemPayment")}</li>
          </ul>
        </aside>
      </section>
    </div>
  );
}
