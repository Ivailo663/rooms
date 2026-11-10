// firebase.js stays JavaScript deliberately: it imports serviceAccountKey.json,
// which is gitignored, so a .ts version would fail to type-check anywhere the
// key isn't present — CI, or a fresh clone. This declares what it exports
// without TypeScript ever having to resolve that JSON.
declare const admin: typeof import("firebase-admin").default;

export default admin;
