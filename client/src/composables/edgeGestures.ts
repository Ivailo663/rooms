// Phone gestures follow the native convention (NAV-10, NAV-11): the left
// edge belongs to "back", so the drawer lives on the right.

/** Width, in px, of the strip along each screen edge where a gesture starts. */
export const EDGE_ZONE = 28;

/**
 * Closed, only a touch on the right edge can open the drawer, so the gesture
 * never fires from the middle of a room list. Open, the drawer covers the
 * whole screen, so a swipe anywhere across it closes it.
 */
export const drawerSwipeCanStart = (
  x: number,
  viewportWidth: number,
  open: boolean
) => open || x >= viewportWidth - EDGE_ZONE;

export const backSwipeCanStart = (x: number) => x <= EDGE_ZONE;

/**
 * Installed to the home screen, there's no browser chrome and no browser back
 * gesture. In a browser tab there is one, and adding ours would go back twice.
 */
export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches === true ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * vue-router records the previous in-app address in `history.state.back`; it
 * is null on the first page of a visit, where "back" would leave the app.
 */
export const hasInAppHistory = () =>
  (window.history.state?.back ?? null) !== null;
