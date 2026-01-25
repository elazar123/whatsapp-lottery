/**
 * Authentication Service
 * Handles Google Sign-In, Sign-Out, and Auth State
 */

import { getAuthInstance, getDbInstance } from '../config/firebase.js';
import { 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut as firebaseSignOut,
    onAuthStateChanged as firebaseOnAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, setDoc, getDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { notifyNewUserRegistration } from './emailNotifications.js';

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();

/**
 * Sign in with Google
 * @returns {Promise<UserCredential>}
 */
export async function signInWithGoogle() {
    const auth = getAuthInstance();
    
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        
        // Create/update user document in Firestore
        await createOrUpdateUser(user);
        
        return result;
    } catch (error) {
        console.error('Google sign-in error:', error);
        throw error;
    }
}

/**
 * Sign out current user
 * @returns {Promise<void>}
 */
export async function signOut() {
    const auth = getAuthInstance();
    
    try {
        await firebaseSignOut(auth);
    } catch (error) {
        console.error('Sign-out error:', error);
        throw error;
    }
}

/**
 * Listen to auth state changes
 * @param {Function} callback - Called with user object (or null)
 * @returns {Function} Unsubscribe function
 */
export function onAuthStateChanged(callback) {
    const auth = getAuthInstance();
    return firebaseOnAuthStateChanged(auth, callback);
}

/**
 * Get current user
 * @returns {User|null}
 */
export function getCurrentUser() {
    const auth = getAuthInstance();
    return auth.currentUser;
}

/**
 * Create or update user document in Firestore
 * @param {User} user - Firebase user object
 * @returns {Promise<void>}
 */
async function createOrUpdateUser(user) {
    const db = getDbInstance();
    const userRef = doc(db, 'users', user.uid);
    
    try {
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            // Create new user document
            await setDoc(userRef, {
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                createdAt: serverTimestamp()
            });
            
            // שליחת התראה למנהל על משתמש חדש
            notifyNewUserRegistration(user);
        } else {
            // Update last login
            await setDoc(userRef, {
                lastLoginAt: serverTimestamp()
            }, { merge: true });
        }
    } catch (error) {
        console.error('Error creating/updating user:', error);
        throw error;
    }
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
    return getCurrentUser() !== null;
}
