import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getMyProfile, updateMyProfile, changeMyPassword, requestAccountDeletion, requestEmailChange } from "../services/api";
import { useTranslation } from "react-i18next";
import { getPasswordChecks, isStrongPassword } from "../utils/passwordPolicy";
import PageState from "../components/PageState";
import WorkspaceNav from "../components/WorkspaceNav";
import styles from "./ProfilePage.module.css";

function profileFromUser(user) {
  return {
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
  };
}

export default function ProfilePage() {
  const { user, token, login, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(() => profileFromUser(user));
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);

  useEffect(() => {
    if (token) {
      getMyProfile(token)
        .then((data) => {
          setProfile({
            firstName: data.firstName || user?.firstName || "",
            lastName: data.lastName || user?.lastName || "",
            email: data.email || user?.email || "",
          });
        })
        .catch((err) => {
          if (err?.status === 401 || err?.status === 403) {
            logout();
            return;
          }

          setError(t("profile.loadFailed"));
        });
    }
  }, [token, user, logout, t]);

  const submitProfile = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");

    setProfileSaving(true);
    try {
      const updated = await updateMyProfile(profile, token);
      setMsg(t("profile.updateSuccess"));

      if (user) {
        login(
          {
            ...user,
            firstName: updated.firstName,
            lastName: updated.lastName,
            email: updated.email,
          },
          token
        );
      }
    } catch (err) {
      if (err?.message === "EMAIL_ALREADY_EXISTS") {
        setError(t("profile.emailAlreadyExists"));
      } else {
        setError(t("profile.updateFailed"));
      }
    } finally {
      setProfileSaving(false);
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setPwdMsg("");
    setPwdError("");

    if (newPassword !== newPassword2) {
      setPwdError(t("profile.passwordMismatch"));
      return;
    }

    if (!isStrongPassword(newPassword)) {
      setPwdError(t("profile.passwordWeak"));
      return;
    }

    setPasswordSaving(true);
    try {
      await changeMyPassword(
        {
          currentPassword,
          newPassword,
        },
        token
      );
      setPwdMsg(t("profile.passwordUpdatedReconnect"));
      setCurrentPassword("");
      setNewPassword("");
      setNewPassword2("");
      await logout();
      navigate("/login", { replace: true, state: { message: t("profile.passwordUpdatedReconnect") } });
    } catch (err) {
      if (err?.message === "PASSWORD_WEAK") {
        setPwdError(t("profile.passwordWeak"));
      } else {
        setPwdError(t("profile.passwordUpdateFailed"));
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteMsg("");
    setDeleteError("");
    setDeleteLoading(true);
    try {
      await requestAccountDeletion(token);
      setDeleteMsg(t("profile.deleteValidationEmailSent"));
      setShowDeleteConfirm(false);
    } catch (err) {
      if (err?.message === "ACCOUNT_DELETION_EMAIL_UNAVAILABLE") {
        setDeleteError(t("profile.deleteEmailUnavailable"));
      } else if (err?.message === "SESSION_EXPIRED" || err?.status === 401 || err?.status === 403) {
        setDeleteError(t("profile.sessionExpired"));
        logout();
      } else {
        setDeleteError(t("profile.deleteRequestFailed"));
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!user) {
    return <PageState type="empty" title={t("profile.title")} message={t("profile.notLoggedIn")} />;
  }

  const displayName = `${profile.firstName || user.firstName || ""} ${profile.lastName || user.lastName || ""}`.trim();
  const initials = `${profile.firstName || user.firstName || "M"}`.slice(0, 1).toUpperCase();
  const passwordChecks = getPasswordChecks(newPassword);
  const passwordRuleLabels = {
    minLength: t("auth.passwordRuleMinLength"),
    uppercase: t("auth.passwordRuleUppercase"),
    lowercase: t("auth.passwordRuleLowercase"),
    number: t("auth.passwordRuleNumber"),
    special: t("auth.passwordRuleSpecial"),
  };

  const submitEmailChange = async (e) => {
    e.preventDefault();
    setEmailMsg("");
    setEmailError("");
    setEmailSaving(true);
    try {
      await requestEmailChange({ newEmail, currentPassword: emailPassword }, token);
      setEmailMsg(t("profile.emailChangeSent"));
      setNewEmail("");
      setEmailPassword("");
    } catch (err) {
      if (err?.message === "EMAIL_ALREADY_EXISTS") setEmailError(t("profile.emailAlreadyExists"));
      else if (err?.message?.includes("CURRENT_PASSWORD_INVALID")) setEmailError(t("profile.currentPasswordInvalid"));
      else if (err?.message?.includes("EMAIL_SERVICE_UNAVAILABLE")) setEmailError(t("profile.emailServiceUnavailable"));
      else setEmailError(t("profile.emailChangeFailed"));
    } finally {
      setEmailSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <WorkspaceNav scope="account" />
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{t("profile.accountKicker")}</p>
          <h1 className={styles.title}>{t("profile.title")}</h1>
          <p className={styles.subtitle}>{t("profile.accountSubtitle")}</p>
        </div>

        <aside className={styles.accountCard}>
          <span className={styles.avatar}>{initials}</span>
          <div className={styles.accountMeta}>
            <strong>{displayName || user.email}</strong>
            <span>{profile.email || user.email}</span>
          </div>
          <span className={styles.roleChip}>{user.role || t("profile.accountStatus")}</span>
        </aside>
      </section>

      <div className={styles.formGrid}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionNumber}>01</span>
            <div>
              <p className={styles.kicker}>{t("profile.identity")}</p>
              <h2 className={styles.sectionTitle}>{t("profile.personalInfo")}</h2>
            </div>
            <p>{t("profile.personalInfoHint")}</p>
          </div>

        <form onSubmit={submitProfile}>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t("auth.firstName")}</label>
            <input
              value={profile.firstName}
              onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t("auth.lastName")}</label>
            <input
              value={profile.lastName}
              onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t("auth.email")}</label>
            <input
              value={profile.email}
              className={styles.input}
              readOnly
              aria-describedby="email-change-hint"
            />
          </div>

          <button type="submit" className={styles.button} disabled={profileSaving}>
            {profileSaving ? t("common.loading") : t("common.save")}
          </button>
        </form>
        {msg && <p className={styles.success}>{msg}</p>}
        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.inlineDivider} />
        <form onSubmit={submitEmailChange}>
          <h3 className={styles.subsectionTitle}>{t("profile.changeEmail")}</h3>
          <p id="email-change-hint" className={styles.formHint}>{t("profile.changeEmailHint")}</p>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="profile-new-email">{t("profile.newEmail")}</label>
            <input id="profile-new-email" type="email" autoComplete="email" value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)} className={styles.input} required />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="profile-email-password">{t("profile.currentPassword")}</label>
            <input id="profile-email-password" type="password" autoComplete="current-password" value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)} className={styles.input} required />
          </div>
          <button type="submit" className={styles.secondaryButton} disabled={emailSaving}>
            {emailSaving ? t("common.loading") : t("profile.sendEmailValidation")}
          </button>
        </form>
        {emailMsg && <p className={styles.success}>{emailMsg}</p>}
        {emailError && <p className={styles.error}>{emailError}</p>}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionNumber}>02</span>
            <div>
              <p className={styles.kicker}>{t("profile.security")}</p>
              <h2 className={styles.sectionTitle}>{t("profile.changePassword")}</h2>
            </div>
            <p>{t("profile.passwordHint")}</p>
          </div>

        <form onSubmit={submitPassword}>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t("profile.currentPassword")}</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t("profile.newPassword")}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t("profile.confirmPassword")}</label>
            <input
              type="password"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              className={styles.input}
            />
          </div>

          <ul className={styles.passwordRules} aria-label={t("auth.passwordRulesTitle")}>
            {passwordChecks.map((check) => (
              <li key={check.key} className={check.isValid ? styles.ruleValid : ""}>
                <span aria-hidden="true">{check.isValid ? "✓" : "·"}</span>
                {passwordRuleLabels[check.key]}
              </li>
            ))}
          </ul>

          <button type="submit" className={styles.button} disabled={passwordSaving}>
            {passwordSaving ? t("common.loading") : t("common.save")}
          </button>
        </form>
        {pwdMsg && <p className={styles.success}>{pwdMsg}</p>}
        {pwdError && <p className={styles.error}>{pwdError}</p>}
        </section>
      </div>

      <section className={`${styles.section} ${styles.dangerZone}`}>
        <div className={styles.dangerCopy}>
          <span className={styles.sectionNumber}>03</span>
          <div>
            <h2 className={styles.sectionTitle}>{t("profile.dangerZone")}</h2>
            <p className={styles.dangerText}>{t("profile.deleteAccountWarning")}</p>
          </div>
        </div>

        {!showDeleteConfirm ? (
          <button
            type="button"
            className={styles.dangerButton}
            onClick={() => {
              setDeleteMsg("");
              setDeleteError("");
              setShowDeleteConfirm(true);
            }}
          >
            {t("profile.deleteAccount")}
          </button>
        ) : (
          <div className={styles.confirmBox}>
            <p className={styles.confirmText}>{t("profile.confirmDeleteAccount")}</p>
            <div className={styles.confirmButtons}>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
              >
                {deleteLoading ? t("common.loading") : t("common.confirm")}
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() => {
                  setDeleteError("");
                  setShowDeleteConfirm(false);
                }}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}
        {deleteMsg && <p className={styles.success}>{deleteMsg}</p>}
        {deleteError && <p className={styles.error}>{deleteError}</p>}
      </section>
    </div>
  );
}
