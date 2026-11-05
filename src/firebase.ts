import { applicationDefault, cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { config } from "./config";

function getCredential() {
  if (!config.firebaseServiceAccountJson) {
    return applicationDefault();
  }

  try {
    const serviceAccount = JSON.parse(config.firebaseServiceAccountJson) as ServiceAccount;
    return cert(serviceAccount);
  } catch (error) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain valid service-account JSON", { cause: error });
  }
}

const firebaseApp = getApps()[0] ?? initializeApp({ credential: getCredential() });

export const firestore = getFirestore(firebaseApp);
