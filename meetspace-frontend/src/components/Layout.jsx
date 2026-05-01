import Navbar from "./Navbar";
import CommandPalette from "./CommandPalette";
import styles from "./Layout.module.css";

export default function Layout({ children }) {
  return (
    <div className={styles.page}>
      <div className={styles.ambient} aria-hidden="true" />
      <Navbar />
      <CommandPalette />
      <main className={styles.main}>
        <div className={styles.shell}>{children}</div>
      </main>
    </div>
  );
}
