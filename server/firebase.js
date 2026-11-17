import fs from "node:fs";
import admin from "firebase-admin";

// The key never goes in git. Deployed, it's a secret file whose path comes
// from GOOGLE_APPLICATION_CREDENTIALS; locally it sits next to this file.
const keyPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ??
  new URL("./serviceAccountKey.json", import.meta.url);
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // PROF-63/64: player media; the server only checks and deletes files.
  storageBucket: "playgrounds-c9391.firebasestorage.app",
});

export default admin;
