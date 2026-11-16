import admin from "firebase-admin";
import serviceAccount from "./serviceAccountKey.json" with { type: "json" };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // PROF-63/64: player media; the server only checks and deletes files.
  storageBucket: "playgrounds-c9391.firebasestorage.app",
});

export default admin;
