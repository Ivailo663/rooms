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
