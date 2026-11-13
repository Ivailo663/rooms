# Navigation (sidebar and mobile drawer)

Code: [App.vue](../../client/src/App.vue),
[AppSidebar.vue](../../client/src/components/AppSidebar.vue).

The main view stays bare and navigation lives in a drawer
([product.md](../product.md)).

- **NAV-01** On desktop, the sidebar starts expanded in Host view and
  collapsed in Play view. A manual toggle sticks until the view changes.
- **NAV-02** On a phone, the navigation drawer starts closed in every view,
  Host included, and opens only when the user opens it. `[gap]` — Host view
  opens it on every page load, and its overlay blocks every tap until it's
  closed.

## Phone gestures

Native-app convention: a swipe from the left edge goes back, so the drawer
lives on the right.

- **NAV-10** On a phone, the drawer slides in from the right edge, on every
  page. A swipe from the right edge towards the left opens it, a swipe to the
  right across it closes it, and its handle sits on the right edge. The
  desktop sidebar stays on the left.
- **NAV-11** A swipe from the left edge towards the right goes back to the
  previous page. In a mobile browser, the browser's own back gesture does
  this and the app adds nothing, so a swipe never goes back twice. Installed
  as an app (standalone), where there's no browser gesture, the app does it.
  With nothing to go back to, nothing happens.
- **NAV-12** A page reached from another page (today: a player's profile,
  `/profiles/:id`) shows a small back arrow at the top left, floating over
  the page, never a bar. It goes back to the previous page, or home when the
  page was opened directly.
- **NAV-13** The phone drawer follows the finger while it's dragged, and on
  release it opens or closes by how far it moved or how fast it was flicked.
  A mostly vertical drag never moves it. Gesture detection comes from a
  maintained library (proposed: `@use-gesture/vanilla`), replacing the
  hand-written `useSwipe.ts`; the edge rules of NAV-10 and NAV-11 stay ours.
  `[deferred]`
