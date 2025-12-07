import { NextApiRequest } from 'next';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';

let adminApp: App | null = null;
let adminAuth: Auth | null = null;

// Initialize Firebase Admin if not already initialized
function initializeFirebaseAdmin() {
  if (adminAuth) return adminAuth;

  try {
    // Check if app already exists
    const existingApps = getApps();
    if (existingApps.length > 0) {
      adminApp = existingApps[0];
      adminAuth = getAuth(adminApp);
      return adminAuth;
    }

    // Initialize new app
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (serviceAccount) {
      adminApp = initializeApp({
        credential: cert(JSON.parse(serviceAccount))
      });
    } else {
      // Fallback: Try to use individual environment variables or default credentials
      try {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
        
        if (projectId && clientEmail && privateKey) {
          adminApp = initializeApp({
            credential: cert({
              projectId,
              clientEmail,
              privateKey,
            })
          });
        } else {
          // Last resort: Try default credentials (for Firebase hosting/cloud functions)
          // Only try this in production environments where default credentials might be available
          if (process.env.NODE_ENV === 'production') {
            try {
              adminApp = initializeApp({});
            } catch (defaultCredError) {
              console.warn('FIREBASE_SERVICE_ACCOUNT not set and default credentials unavailable. API routes may not work properly.');
              return null;
            }
          } else {
            // In development, don't try default credentials - they won't work
            console.warn('Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY in .env.local');
            return null;
          }
        }
      } catch (e) {
        console.warn('FIREBASE_SERVICE_ACCOUNT not set and default credentials unavailable. API routes may not work properly.');
        return null;
      }
    }

    if (adminApp) {
      adminAuth = getAuth(adminApp);
      return adminAuth;
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }

  return null;
}

export async function verifyAuthToken(req: NextApiRequest): Promise<{ uid: string; email: string } | null> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Initialize admin if needed
    const auth = initializeFirebaseAdmin();
    if (!auth) {
      console.error('Firebase Admin not initialized');
      return null;
    }

    const decodedToken = await auth.verifyIdToken(token);
    
    return {
      uid: decodedToken.uid,
      email: decodedToken.email || ''
    };
  } catch (error: any) {
    // Only log detailed errors in development, suppress in production to reduce noise
    if (process.env.NODE_ENV === 'development') {
      // Check if it's a configuration error (missing credentials)
      if (error?.message?.includes('Project Id') || error?.message?.includes('Unable to detect')) {
        // This is expected if Firebase Admin isn't configured - don't spam logs
        return null;
      }
      console.error('Token verification failed:', error);
    }
    return null;
  }
}

// Alias for backward compatibility
export const verifyAuth = verifyAuthToken;

