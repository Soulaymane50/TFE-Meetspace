import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  adminCreateEspace,
  adminGetEspace,
  adminUpdateEspace,
} from "../services/api";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PageState from "../components/PageState";
import SelectDropdown from "../components/SelectDropdown";
import styles from "./AdminEspaceForm.module.css";

export default function AdminEspaceForm() {
  const { user, token } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const isEditMode = !!id;

  const [form, setForm] = useState({
    name: "",
    type: "SALLE",
    capacity: 1,
    basePrice: 0,
    status: "AVAILABLE",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(isEditMode);
  const [loadError, setLoadError] = useState("");
  const [retryVersion, setRetryVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const typeOptions = [
    { value: "SALLE", label: t("spaceType.salle") },
    { value: "PREMIUM_ROOM", label: t("spaceType.premiumRoom") },
  ];
  const statusOptions = [
    { value: "AVAILABLE", label: t("status.available") },
    { value: "UNAVAILABLE", label: t("status.unavailable") },
  ];

  useEffect(() => {
    if (!user || user.role !== "ADMIN") {
      navigate("/login");
      return;
    }

    if (!isEditMode) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    adminGetEspace(id, token)
      .then((entry) => {
        if (!cancelled) setForm({
          name: entry.name || "", type: entry.type || "SALLE",
          capacity: entry.capacity ?? 1, basePrice: entry.basePrice ?? 0,
          status: entry.status || "AVAILABLE",
        });
      })
      .catch((err) => { if (!cancelled) setLoadError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, token, id, isEditMode, navigate, retryVersion]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        name === "capacity" || name === "basePrice"
          ? Number(value)
          : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || loadError || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setError("");

    try {
      if (isEditMode) {
        await adminUpdateEspace(id, form, token);
      } else {
        await adminCreateEspace(form, token);
      }
      navigate("/admin");
    } catch (err) {
      setError(err.message);
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  if (!user || user.role !== "ADMIN") return null;
  if (loading) return <PageState type="loading" title={t("common.loading")} message={t("admin.editSpace")} />;
  if (loadError) return <PageState type="error" title={t("common.error")} message={loadError} action={<><button type="button" onClick={() => { setLoading(true); setRetryVersion(value => value + 1); }}>{t("common.retry")}</button><Link to="/admin/espaces">{t("common.back")}</Link></>} />;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        {isEditMode ? t('admin.editSpace') : t('admin.createSpace')}
      </h1>

      <p><Link to="/admin">{"\u2190"} {t('admin.backToDashboard')}</Link></p>

      {error && <p className={styles.error}>{error}</p>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="AdminEspaceForm-name">{t('admin.name')} :</label>
          <input id="AdminEspaceForm-name"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            className={styles.input}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>{t('common.type')} :</label>
          <SelectDropdown
            value={form.type}
            onChange={(value) => handleChange({ target: { name: "type", value } })}
            options={typeOptions}
            label={t('common.type')}
            className={styles.selectDropdown}
          />
          {form.type === "PREMIUM_ROOM" && (
            <p className={styles.infoText}>
              {t('spaces.premiumRoomRequiresApproval')}
            </p>
          )}
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="AdminEspaceForm-capacity">{t('common.capacity')} :</label>
            <input id="AdminEspaceForm-capacity"
              name="capacity"
              type="number"
              value={form.capacity}
              onChange={handleChange}
              min="1"
              required
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="AdminEspaceForm-basePrice">{t('admin.basePrice')} ({"\u20ac"}) :</label>
            <input id="AdminEspaceForm-basePrice"
              name="basePrice"
              type="number"
              value={form.basePrice}
              onChange={handleChange}
              min="0"
              step="0.01"
              className={styles.input}
            />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>{t('common.status')} :</label>
          <SelectDropdown
            value={form.status}
            onChange={(value) => handleChange({ target: { name: "status", value } })}
            options={statusOptions}
            label={t('common.status')}
            className={styles.selectDropdown}
          />
        </div>

        <div className={styles.buttonGroup}>
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className={styles.cancelButton}
          >
            {t('common.cancel')}
          </button>
          <button type="submit" className={styles.submitButton} disabled={saving}>
            {saving ? t('common.saving') : isEditMode ? t('common.save') : t('common.create')}
          </button>
        </div>
      </form>
    </div>
  );
}
