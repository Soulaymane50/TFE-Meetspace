import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { COMMAND_PALETTE_EVENT } from "./commandPaletteBus";
import styles from "./CommandPalette.module.css";

function CommandIcon({ type }) {
  const icons = {
    home: (
      <>
        <path d="m4 11 8-7 8 7" />
        <path d="M6 10v10h12V10" />
      </>
    ),
    events: (
      <>
        <path d="M7 3v3M17 3v3" />
        <path d="M4.5 8.5h15" />
        <path d="M6.5 5h11A2.5 2.5 0 0 1 20 7.5v10A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5Z" />
      </>
    ),
    spaces: (
      <>
        <path d="M4 20V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5V20" />
        <path d="M8 20v-6h8v6" />
        <path d="M8 8h.01M12 8h.01M16 8h.01M8 11h.01M12 11h.01M16 11h.01" />
      </>
    ),
    parking: (
      <>
        <path d="M6 20V4h7a5 5 0 0 1 0 10H9" />
        <path d="M9 14v6" />
      </>
    ),
    user: (
      <>
        <path d="M16 20a4 4 0 0 0-8 0" />
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      </>
    ),
    admin: (
      <>
        <path d="M12 3 5 6v5c0 4.8 3 8.2 7 10 4-1.8 7-5.2 7-10V6Z" />
        <path d="m9.5 12 1.8 1.8 3.7-4" />
      </>
    ),
    search: (
      <>
        <path d="M10.5 18a7.5 7.5 0 1 1 5.3-2.2L21 21" />
      </>
    ),
  };

  return (
    <svg className={styles.iconSvg} viewBox="0 0 24 24" aria-hidden="true">
      {icons[type] || icons.search}
    </svg>
  );
}

export default function CommandPalette() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const commands = useMemo(() => {
    const base = [
      { id: "home", icon: "home", group: t("command.groups.explore"), label: t("nav.home"), description: t("command.homeDesc"), to: "/" },
      { id: "events", icon: "events", group: t("command.groups.explore"), label: t("nav.events"), description: t("command.eventsDesc"), to: "/events" },
      { id: "spaces", icon: "spaces", group: t("command.groups.explore"), label: t("nav.spaces"), description: t("command.spacesDesc"), to: "/espace" },
      { id: "parking", icon: "parking", group: t("command.groups.explore"), label: t("nav.parking"), description: t("command.parkingDesc"), to: "/parking" },
    ];

    if (!user) {
      return [
        ...base,
        { id: "login", icon: "user", group: t("command.groups.account"), label: t("nav.login"), description: t("command.loginDesc"), to: "/login" },
        { id: "register", icon: "user", group: t("command.groups.account"), label: t("nav.register"), description: t("command.registerDesc"), to: "/register" },
      ];
    }

    const account = [
      { id: "reservations", icon: "spaces", group: t("command.groups.account"), label: t("nav.myReservations"), description: t("command.reservationsDesc"), to: "/my-reservations" },
      { id: "profile", icon: "user", group: t("command.groups.account"), label: t("nav.profile"), description: t("command.profileDesc"), to: "/profile" },
    ];

    if (user.role === "ORGANIZER" || user.role === "ADMIN") {
      account.push({
        id: "organizer",
        icon: "events",
        group: t("command.groups.manage"),
        label: t("nav.organizerEvents"),
        description: t("command.organizerDesc"),
        to: "/organizer/events",
      });
    }

    if (user.role === "ADMIN") {
      account.push({
        id: "admin",
        icon: "admin",
        group: t("command.groups.manage"),
        label: t("nav.admin"),
        description: t("command.adminDesc"),
        to: "/admin",
      });
    }

    return [...base, ...account];
  }, [t, user]);

  const filteredCommands = useMemo(() => {
    const value = deferredQuery.trim().toLowerCase();
    if (!value) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.description} ${command.group}`.toLowerCase().includes(value)
    );
  }, [commands, deferredQuery]);

  useEffect(() => {
    const handleOpen = () => {
      setOpen(true);
      setQuery("");
    };

    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        handleOpen();
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener(COMMAND_PALETTE_EVENT, handleOpen);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener(COMMAND_PALETTE_EVENT, handleOpen);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  const runCommand = (to) => {
    navigate(to);
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onMouseDown={() => setOpen(false)}>
      <section className={styles.palette} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <p>{t("command.eyebrow")}</p>
            <h2>{t("command.title")}</h2>
          </div>
          <span>{t("command.shortcut")}</span>
        </div>

        <label className={styles.searchBox}>
          <CommandIcon type="search" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("command.placeholder")}
          />
        </label>

        <div className={styles.commandList}>
          {filteredCommands.length === 0 ? (
            <p className={styles.empty}>{t("command.noResults")}</p>
          ) : (
            filteredCommands.map((command) => (
              <button key={command.id} type="button" className={styles.commandItem} onClick={() => runCommand(command.to)}>
                <span className={styles.commandIcon}>
                  <CommandIcon type={command.icon} />
                </span>
                <span className={styles.commandContent}>
                  <small>{command.group}</small>
                  <strong>{command.label}</strong>
                  <em>{command.description}</em>
                </span>
                <span className={styles.commandArrow}>{"\u2192"}</span>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
