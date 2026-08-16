import { Component } from "react";
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
          <h1 id="app-error-title">Cette page n’a pas pu s’afficher</h1>
          <p className={styles.description}>
            Vos données n’ont pas été modifiées. Rechargez la page pour reprendre votre parcours.
          </p>
          <div className={styles.actions}>
            <button type="button" onClick={() => window.location.reload()}>Recharger</button>
            <a href="/">Retour à l’accueil</a>
          </div>
        </section>
      </main>
    );
  }
}
