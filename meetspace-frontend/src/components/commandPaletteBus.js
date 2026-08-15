export const COMMAND_PALETTE_EVENT = "meetspace:open-command-palette";

let paletteOpen = false;
const paletteListeners = new Set();

function emitPaletteChange() {
  paletteListeners.forEach((listener) => listener());
}

export function openCommandPalette() {
  paletteOpen = true;
  emitPaletteChange();
  window.dispatchEvent(new Event(COMMAND_PALETTE_EVENT));
}

export function closeCommandPalette() {
  paletteOpen = false;
  emitPaletteChange();
}

export function subscribeCommandPalette(listener) {
  paletteListeners.add(listener);
  return () => paletteListeners.delete(listener);
}

export function getCommandPaletteSnapshot() {
  return paletteOpen;
}

if (typeof window !== "undefined") {
  if (window.__meetspaceCommandPaletteShortcutHandler) {
    window.removeEventListener("keydown", window.__meetspaceCommandPaletteShortcutHandler);
  }

  const shortcutHandler = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openCommandPalette();
    }

    if (event.key === "Escape") closeCommandPalette();
  };

  window.addEventListener("keydown", shortcutHandler);
  window.__meetspaceCommandPaletteShortcutHandler = shortcutHandler;
}
