import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { app, auth } from '../firebaseConfig';
import SessionManager from '../services/SessionManager';

// Auth is initialized in firebaseConfig with RN persistence

// Auth Context
const AuthContext = createContext();

// Auth Actions
const AUTH_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_USER: 'SET_USER',
  SET_AUTHENTICATED: 'SET_AUTHENTICATED',
  LOGOUT: 'LOGOUT',
  SET_AUTO_LOGIN_ATTEMPTED: 'SET_AUTO_LOGIN_ATTEMPTED',
};

// Initial State
const initialState = {
  isLoading: true,
  isAuthenticated: false,
  user: null,
  autoLoginAttempted: false,
};

// Auth Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };
    case AUTH_ACTIONS.SET_USER:
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false,
        autoLoginAttempted: true,
      };
    case AUTH_ACTIONS.SET_AUTHENTICATED:
      return {
        ...state,
        isAuthenticated: action.payload,
        isLoading: false,
        autoLoginAttempted: true,
      };
    case AUTH_ACTIONS.SET_AUTO_LOGIN_ATTEMPTED:
      return {
        ...state,
        autoLoginAttempted: action.payload,
      };
    case AUTH_ACTIONS.LOGOUT:
      return {
        ...initialState,
        isLoading: false,
        autoLoginAttempted: true,
      };
    default:
      return state;
  }
};

// Storage Keys
const STORAGE_KEYS = {
  USER_TOKEN: '@cooktribe_user_token',
  USER_DATA: '@cooktribe_user_data',
  IS_AUTHENTICATED: '@cooktribe_is_authenticated',
  LAST_LOGIN_TIME: '@cooktribe_last_login_time',
  REMEMBER_ME: '@cooktribe_remember_me',
};

// Session timeout (7 days in milliseconds)
const SESSION_TIMEOUT = 7 * 24 * 60 * 60 * 1000;

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check if user is already logged in on app start
  useEffect(() => {
    checkAuthState();
  }, []);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in
        await saveUserData(user);
        dispatch({
          type: AUTH_ACTIONS.SET_USER,
          payload: user,
        });
      } else {
        // User is signed out - only clear if auto login was attempted
        if (state.autoLoginAttempted) {
          await clearUserData();
          dispatch({
            type: AUTH_ACTIONS.LOGOUT,
          });
        }
      }
    });

    return unsubscribe;
  }, [state.autoLoginAttempted]);

  // Check authentication state on app startup
  const checkAuthState = async () => {
    try {
      dispatch({
        type: AUTH_ACTIONS.SET_LOADING,
        payload: true,
      });

      // Use SessionManager to load session
      const sessionResult = await SessionManager.loadSession();

      if (sessionResult.success) {
        console.log('Auto-login: Restoring user session');
        dispatch({
          type: AUTH_ACTIONS.SET_USER,
          payload: sessionResult.sessionInfo.user,
        });
      } else {
        console.log('Auto-login failed:', sessionResult.reason);
        dispatch({
          type: AUTH_ACTIONS.SET_AUTO_LOGIN_ATTEMPTED,
          payload: true,
        });
        dispatch({
          type: AUTH_ACTIONS.SET_LOADING,
          payload: false,
        });
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
      // Clear potentially corrupted data
      await SessionManager.clearSession();
      dispatch({
        type: AUTH_ACTIONS.SET_AUTO_LOGIN_ATTEMPTED,
        payload: true,
      });
      dispatch({
        type: AUTH_ACTIONS.SET_LOADING,
        payload: false,
      });
    }
  };

  // Save user data to storage using SessionManager
  const saveUserData = async (user, rememberMe = true) => {
    try {
      const result = await SessionManager.saveSession(user, rememberMe);
      if (result.success) {
        console.log('User data saved to storage successfully');
      } else {
        console.error('Failed to save user data:', result.error);
      }
      return result;
    } catch (error) {
      console.error('Error saving user data:', error);
      return { success: false, error: error.message };
    }
  };

  // Clear user data from storage using SessionManager
  const clearUserData = async () => {
    try {
      const result = await SessionManager.clearSession();
      if (result.success) {
        console.log('User data cleared from storage');
      } else {
        console.error('Error clearing user data:', result.error);
      }
      return result;
    } catch (error) {
      console.error('Error clearing user data:', error);
      return { success: false, error: error.message };
    }
  };

  // Check if user session is valid using SessionManager
  const isSessionValid = async () => {
    try {
      return await SessionManager.isSessionValid();
    } catch (error) {
      console.error('Error checking session validity:', error);
      return false;
    }
  };

  // Login function
  const login = async (user, rememberMe = true) => {
    await saveUserData(user, rememberMe);
    dispatch({
      type: AUTH_ACTIONS.SET_USER,
      payload: user,
    });
  };

  // Logout function
  const logout = async () => {
    try {
      await auth.signOut();
      await clearUserData();
      dispatch({
        type: AUTH_ACTIONS.LOGOUT,
      });
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  // Refresh session using SessionManager
  const refreshSession = async (extendBy = null) => {
    try {
      const result = await SessionManager.refreshSession(extendBy);
      if (result.success) {
        console.log('Session refreshed successfully');
      } else {
        console.error('Failed to refresh session:', result.reason);
      }
      return result;
    } catch (error) {
      console.error('Error refreshing session:', error);
      return { success: false, error: error.message };
    }
  };

  // Get session info using SessionManager
  const getSessionInfo = async () => {
    try {
      return await SessionManager.getSessionInfo();
    } catch (error) {
      console.error('Error getting session info:', error);
      return null;
    }
  };

  // Get user data from storage
  const getUserFromStorage = async () => {
    try {
      const sessionResult = await SessionManager.loadSession();
      if (sessionResult.success) {
        return sessionResult.sessionInfo.user;
      }
      return null;
    } catch (error) {
      console.error('Error getting user from storage:', error);
      return null;
    }
  };

  // Context value
  const value = {
    ...state,
    login,
    logout,
    checkAuthState,
    refreshSession,
    isSessionValid,
    getSessionInfo,
    getUserFromStorage,
    clearUserData,
    SessionManager, // Expose SessionManager for advanced usage
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
