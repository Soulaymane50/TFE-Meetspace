export const COMMAND_PALETTE_EVENT = "meetspace:open-command-palette";

export function openCommandPalette() {
  window.dispatchEvent(new Event(COMMAND_PALETTE_EVENT));
}
