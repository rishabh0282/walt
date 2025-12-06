/**
 * Firebase configuration and initialization
 * 
 * Firebase provides authentication and metadata storage while IPFS handles actual file storage.
 * This separation allows us to maintain user accounts and file metadata centrally while keeping
 * the actual file content decentralized and censorship-resistant on IPFS.
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

// Handles user authentication, session management, and provider integration (Google OAuth)
export const auth = getAuth(app);

// Stores file metadata, user preferences, and sharing configurations
// Actual file content lives on IPFS to ensure decentralization
export const db = getFirestore(app);

export default app;
