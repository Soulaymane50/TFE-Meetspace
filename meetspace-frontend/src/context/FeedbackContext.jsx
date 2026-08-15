import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import styles from "./FeedbackContext.module.css";

const FeedbackContext = createContext(null);

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const confirmButtonRef = useRef(null);

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(({ type = "info", title, message }) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, type, title, message }]);
    window.setTimeout(() => {
      removeToast(id);
    }, 4200);
  }, [removeToast]);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setConfirmState({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel || "Confirmer",
        cancelLabel: options.cancelLabel || "Annuler",
        tone: options.tone || "default",
        resolve,
      });
    });
  }, []);

  const closeConfirm = useCallback((result) => {
    setConfirmState((current) => {
      current?.resolve(result);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!confirmState) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => confirmButtonRef.current?.focus(), 40);
    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeConfirm(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeConfirm, confirmState]);

  const value = useMemo(() => ({ notify, confirm }), [notify, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div className={styles.toastStack} aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.type] || styles.info}`} role="status">
            <span className={styles.toastMarker} aria-hidden="true" />
            <span className={styles.toastContent}>
              {toast.title && <strong>{toast.title}</strong>}
              {toast.message && <span>{toast.message}</span>}
            </span>
            <button type="button" className={styles.toastClose} onClick={() => removeToast(toast.id)} aria-label="Fermer la notification">
              ×
            </button>
          </div>
        ))}
      </div>

      {confirmState && (
        <div className={styles.confirmOverlay} onMouseDown={() => closeConfirm(false)}>
          <div
            className={styles.confirmBox}
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-confirm-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div>
              <p className={styles.confirmKicker}>Confirmation</p>
              <h2 id="feedback-confirm-title">{confirmState.title}</h2>
              {confirmState.message && <p>{confirmState.message}</p>}
            </div>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.cancelButton} onClick={() => closeConfirm(false)}>
                {confirmState.cancelLabel}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                className={`${styles.confirmButton} ${confirmState.tone === "danger" ? styles.dangerButton : ""}`}
                onClick={() => closeConfirm(true)}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback must be used inside FeedbackProvider");
  }
  return context;
}
