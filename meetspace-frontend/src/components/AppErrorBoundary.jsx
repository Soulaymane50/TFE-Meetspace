import { Component } from "react";
import i18n from "../i18n";
import styles from "./AppErrorBoundary.module.css";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, details) {
    if (import.meta.env.DEV) {
      console.error("MeetSpace rendering error", error, details);
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className={styles.page}>
        <section className={styles.message} aria-labelledby="app-error-title">
          <span className={styles.marker} aria-hidden="true">!</span>
          <p>MeetSpace</p>
          <h1 id="app-error-title">{i18n.t("system.appErrorTitle")}</h1>
          <p className={styles.description}>
            {i18n.t("system.appErrorMessage")}
          </p>
          <div className={styles.actions}>
            <button type="button" onClick={() => window.location.reload()}>{i18n.t("system.reload")}</button>
            <a href="/">{i18n.t("system.backHome")}</a>
          </div>
        </section>
      </main>
    );
  }
}
