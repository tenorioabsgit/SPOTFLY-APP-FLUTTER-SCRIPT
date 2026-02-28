import * as admin from 'firebase-admin';
import * as path from 'path';

export const STORAGE_BUCKET = 'spotfly-app.firebasestorage.app';

export function initFirebaseAdmin(): admin.firestore.Firestore {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccountEnv) {
    const serviceAccount = JSON.parse(serviceAccountEnv);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: STORAGE_BUCKET,
    });
  } else {
    const serviceAccount = require(
      path.resolve(__dirname, '..', 'serviceAccountKey.json')
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: STORAGE_BUCKET,
    });
  }

  return admin.firestore();
}

export function getStorageBucket() {
  if (admin.apps.length === 0) {
    initFirebaseAdmin();
  }
  return admin.storage().bucket();
}
