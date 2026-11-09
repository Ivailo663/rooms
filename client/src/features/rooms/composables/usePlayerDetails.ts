import { onBeforeUnmount, ref } from "vue";
import { useEventListener } from "@vueuse/core";
import type { PlayerSummary } from "@football/shared";

// Delay before a card closes, so moving the pointer across the gap between an
// avatar and the card below it doesn't dismiss what you were reaching for.
const CLOSE_DELAY = 120;

// Which player's details card is open, and the avatar it hangs off. Hover and
// focus open it on desktop; a tap opens it on touch screens, where nothing
// hovers, so a tap anywhere outside the avatar and the card is what closes it.
export const usePlayerDetails = () => {
  const open = ref<{ player: PlayerSummary; anchor: HTMLElement } | null>(
    null
  );
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  const cancelClose = () => {
    clearTimeout(closeTimer);
    closeTimer = undefined;
  };

  const close = () => {
    cancelClose();
    open.value = null;
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer = setTimeout(close, CLOSE_DELAY);
  };

  const show = (player: PlayerSummary, event: Event) => {
    cancelClose();
    open.value = { player, anchor: event.currentTarget as HTMLElement };
  };

  useEventListener(document, "pointerdown", (event) => {
    if (!open.value) return;
    const target = event.target as Element | null;
    if (open.value.anchor.contains(target)) return;
    if (target?.closest("[data-player-details-card]")) return;
    close();
  });

  onBeforeUnmount(cancelClose);

  return { open, show, scheduleClose, cancelClose, close };
};
