import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, Auth } from 'firebase/auth';
// @ts-ignore - getReactNativePersistence exists at runtime in firebase/auth
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// CONFIGURAÇÃO DO FIREBASE
// Substitua os valores abaixo pelos dados do seu projeto Firebase
// Console: https://console.firebase.google.com/
// ============================================================
const firebaseConfig = {
  apiKey: 'AIzaSyAlcChuWLkw9-zuf_GAkvU3drg6Hz1NQhc',
  authDomain: 'spotfly-app.firebaseapp.com',
  projectId: 'spotfly-app',
  storageBucket: 'spotfly-app.firebasestorage.app',
  messagingSenderId: '215760117220',
  appId: '1:215760117220:web:62871c1c1fc7f651503bf1',
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    auth = getAuth(app);
  }
} else {
  app = getApps()[0];
  auth = getAuth(app);
}

db = getFirestore(app);
storage = getStorage(app);

export { app, auth, db, storage };
