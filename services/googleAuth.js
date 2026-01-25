import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { app } from '../firebaseConfig';

const auth = getAuth(app);

// Google Sign-in configuration
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  offlineAccess: true,
  hostedDomain: '',
  forceCodeForRefreshToken: true,
});

export const signInWithGoogle = async () => {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    
    if (result.type === 'success' && result.data) {
      const { idToken } = result.data;
      if (idToken) {
        const credential = GoogleAuthProvider.credential(idToken);
        const userCredential = await signInWithCredential(auth, credential);
        
        return {
          success: true,
          user: userCredential.user,
        };
      }
    }
    
    if (result.idToken) {
      const credential = GoogleAuthProvider.credential(result.idToken);
      const userCredential = await signInWithCredential(auth, credential);
      
      return {
        success: true,
        user: userCredential.user,
      };
    }
    
    throw new Error('No ID token received from Google');
  } catch (error) {
    
    if (error.code === 'SIGN_IN_CANCELLED') {
      return {
        success: false,
        error: 'Sign-in was cancelled by user',
      };
    } else if (error.code === 'IN_PROGRESS') {
      return {
        success: false,
        error: 'Sign-in is already in progress',
      };
    } else if (error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
      return {
        success: false,
        error: 'Google Play Services not available. Please update Google Play Services.',
      };
    } else {
      return {
        success: false,
        error: error.message || 'Failed to sign in with Google',
      };
    }
  }
};

// Alternative function (for backward compatibility)
export const signInWithGoogleAlternative = async () => {
  return await signInWithGoogle();
};