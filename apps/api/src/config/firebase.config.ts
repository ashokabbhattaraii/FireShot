import { Logger } from "@nestjs/common";

const logger = new Logger("FirebaseConfig");

let firebaseApp: any = null;

export function getFirebaseApp() {
  if (firebaseApp) return firebaseApp;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    logger.warn("FIREBASE_SERVICE_ACCOUNT_JSON not set — push notifications disabled");
    return null;
  }

  try {
    // Lazy require so the module is optional in dev when firebase-admin isn't installed yet.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admin = require("firebase-admin");
    if (admin.apps.length > 0) {
      firebaseApp = admin.apps[0];
      return firebaseApp;
    }

    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      json = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    }

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(json),
    });
    logger.log("Firebase Admin initialized");
    return firebaseApp;
  } catch (e: any) {
    logger.warn(`Firebase init failed: ${e.message}`);
    return null;
  }
}

export function getMessaging() {
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admin = require("firebase-admin");
    return admin.messaging(app);
  } catch {
    return null;
  }
}
