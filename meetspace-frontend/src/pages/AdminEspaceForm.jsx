import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  adminCreateEspace,
  adminGetEspace,
  adminUpdateEspace,
} from "../services/api";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
    capacity: 0,
    basePrice: 0,
    status: "AVAILABLE",
  });
  const [error, setError] = useState("");
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

    if (isEditMode) {
      adminGetEspace(id, token)
        .then((e) =>
          setForm({
            name: e.name || "",
            type: e.type || "",
            capacity: e.capacity || 0,
            basePrice: e.basePrice || 0,
            status: e.status || "AVAILABLE",
          })
        )
        .catch((err) => setError(err.message));
    }
  }, [user, token, id, isEditMode, navigate]);

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
    }
  };

  if (!user || user.role !== "ADMIN") return null;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        {isEditMode ? t('admin.editSpace') : t('admin.createSpace')}
      </h1>

      <p><Link to="/admin">{"\u2190"} {t('admin.backToDashboard')}</Link></p>

      {error && <p className={styles.error}>{error}</p>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('admin.name')} :</label>
          <input
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
            <label className={styles.label}>{t('common.capacity')} :</label>
            <input
              name="capacity"
              type="number"
              value={form.capacity}
              onChange={handleChange}
              min="0"
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t('admin.basePrice')} ({"\u20ac"}) :</label>
            <input
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
          <button type="submit" className={styles.submitButton}>
            {isEditMode ? t('common.save') : t('common.create')}
          </button>
        </div>
      </form>
    </div>
  );
}
