import Navbar from "./Navbar";
import styles from "./Layout.module.css";

export default function Layout({ children }) {
  return (
    <div className={styles.page}>
      <div className={styles.ambient} aria-hidden="true" />
      <Navbar />
      <main className={styles.main}>
        <div className={styles.shell}>{children}</div>
      </main>
    </div>
  );
}
