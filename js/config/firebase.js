/**
 * Firebase Configuration & Initialization
 * 
 * INSTRUCTIONS:
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a new project (or select existing)
 * 3. Add a Web app to your project
 * 4. Copy your firebaseConfig object and paste it below
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ✅ Firebase Configuration - whatsapp-lottery1
const firebaseConfig = {
    apiKey: "AIzaSyA3ofysjEvOZ5Aj3OQD7kivsxlmm8R-kIc",
    authDomain: "whatsapp-lottery1.firebaseapp.com",
    projectId: "whatsapp-lottery1",
    storageBucket: "whatsapp-lottery1.firebasestorage.app",
    messagingSenderId: "609830793589",
    appId: "1:609830793589:web:4fb095c027f4642063a33c",
    measurementId: "G-3Y3S76MVVQ"
};

// Initialize Firebase
let app = null;
let auth = null;
let db = null;

/**
 * Initialize Firebase services
 * @returns {{ app: FirebaseApp, auth: Auth, db: Firestore }}
 */
export function initFirebase() {
    if (!app) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
    }
    return { app, auth, db };
}

/**
 * Get Firebase Auth instance
 * @returns {Auth}
 */
export function getAuthInstance() {
    if (!auth) {
        initFirebase();
    }
    return auth;
}

/**
 * Get Firestore instance
 * @returns {Firestore}
 */
export function getDbInstance() {
    if (!db) {
        initFirebase();
    }
    return db;
}

// Export config for reference
export { firebaseConfig };
