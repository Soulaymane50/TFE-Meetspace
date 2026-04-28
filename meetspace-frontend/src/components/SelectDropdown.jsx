import { useEffect, useId, useRef, useState } from "react";
import styles from "./SelectDropdown.module.css";

export default function SelectDropdown({
  value,
  onChange,
  options,
  label,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listboxId = useId();

  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} className={`${styles.dropdown} ${className}`.trim()}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`.trim()}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={styles.triggerText}>{selectedOption?.label}</span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`.trim()} aria-hidden="true">
          <svg viewBox="0 0 12 12" focusable="false">
            <path d="M2 4.5 6 8l4-3.5" />
          </svg>
        </span>
      </button>

      {open && (
        <div className={styles.menuSurface}>
          <ul id={listboxId} className={styles.menu} role="listbox" aria-label={label}>
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <li key={option.value} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    className={`${styles.option} ${isSelected ? styles.optionSelected : ""}`.trim()}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <span>{option.label}</span>
                    {isSelected && <span className={styles.optionMarker} aria-hidden="true">✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
