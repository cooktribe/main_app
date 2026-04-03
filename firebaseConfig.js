// Import the functions you need from the SDKs you need
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extra = Constants?.expoConfig?.extra || Constants?.manifest?.extra || {};

function getAndroidFirebaseConfigFromGoogleServices() {
  try {
    // Bundled into the JS bundle; also used by the native Gradle plugin.
    const googleServices = require('./google-services.json');
    const projectInfo = googleServices?.project_info;
    const packageName =
      Constants?.expoConfig?.android?.package || Constants?.manifest?.android?.package;

    const client =
      googleServices?.client?.find(
        (c) => c?.client_info?.android_client_info?.package_name === packageName
      ) || googleServices?.client?.[0];

    const apiKey = client?.api_key?.[0]?.current_key;
    const projectId = projectInfo?.project_id;

    if (!apiKey || !projectId) return null;

    return {
      apiKey,
      authDomain: `${projectId}.firebaseapp.com`,
      projectId,
      storageBucket: projectInfo?.storage_bucket,
      messagingSenderId: projectInfo?.project_number,
      appId: client?.client_info?.mobilesdk_app_id,
    };
  } catch {
    return null;
  }
}

const androidFallbackConfig =
  Platform.OS === 'android' ? getAndroidFirebaseConfigFromGoogleServices() : null;

const firebaseConfig = {
  apiKey:
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
    extra.FIREBASE_API_KEY ||
    androidFallbackConfig?.apiKey,
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    extra.FIREBASE_AUTH_DOMAIN ||
    androidFallbackConfig?.authDomain,
  projectId:
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ||
    extra.FIREBASE_PROJECT_ID ||
    androidFallbackConfig?.projectId,
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    extra.FIREBASE_STORAGE_BUCKET ||
    androidFallbackConfig?.storageBucket,
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    extra.FIREBASE_MESSAGING_SENDER_ID ||
    androidFallbackConfig?.messagingSenderId,
  appId:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID ||
    extra.FIREBASE_APP_ID ||
    androidFallbackConfig?.appId,
};

// Basic runtime validation to avoid misconfiguration
const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingKeys.length > 0) {
  console.warn(
    `Firebase config is missing required keys: ${missingKeys.join(', ')}. ` +
      'Ensure EXPO_PUBLIC_* env vars are set (see .env.example).'
  );
}

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let auth;
try {
  const persistence =
    typeof getReactNativePersistence === 'function'
      ? getReactNativePersistence(AsyncStorage)
      : undefined;

  // Initialize Firebase Auth with React Native persistence when available.
  // If it was already initialized, this throws and we fall back to `getAuth()`.
  auth = initializeAuth(app, persistence ? { persistence } : {});
} catch {
  auth = getAuth(app);
}

// Firestore and Storage
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };