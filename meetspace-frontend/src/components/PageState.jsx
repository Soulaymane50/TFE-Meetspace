import styles from "./PageState.module.css";

export default function PageState({ type = "loading", title, message, action }) {
  const variantClass = styles[type] || "";

  return (
    <section className={`${styles.state} ${variantClass}`.trim()} role={type === "error" ? "alert" : "status"}>
      <div className={styles.marker} aria-hidden="true">
        {type === "loading" ? <span className={styles.spinner} /> : <span>{type === "error" ? "!" : "i"}</span>}
      </div>
      <div className={styles.content}>
        {title && <h1 className={styles.title}>{title}</h1>}
        {message && <p className={styles.message}>{message}</p>}
        {action && <div className={styles.action}>{action}</div>}
      </div>
    </section>
  );
}
