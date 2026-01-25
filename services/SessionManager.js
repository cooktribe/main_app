import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage Keys
const STORAGE_KEYS = {
  USER_TOKEN: '@cooktribe_user_token',
  USER_DATA: '@cooktribe_user_data',
  IS_AUTHENTICATED: '@cooktribe_is_authenticated',
  LAST_LOGIN_TIME: '@cooktribe_last_login_time',
  REMEMBER_ME: '@cooktribe_remember_me',
  SESSION_ID: '@cooktribe_session_id',
  AUTO_LOGOUT_TIME: '@cooktribe_auto_logout_time',
};

// Session timeout configurations
const SESSION_TIMEOUTS = {
  SHORT: 24 * 60 * 60 * 1000, // 1 day
  MEDIUM: 3 * 24 * 60 * 60 * 1000, // 3 days
  LONG: 7 * 24 * 60 * 60 * 1000, // 7 days
  EXTENDED: 30 * 24 * 60 * 60 * 1000, // 30 days
};

class SessionManager {
  constructor() {
    this.sessionId = null;
    this.sessionTimeout = SESSION_TIMEOUTS.LONG; // Default 7 days
  }

  // Generate unique session ID
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Save session data
  async saveSession(user, rememberMe = true, customTimeout = null) {
    try {
      const sessionId = this.generateSessionId();
      const currentTime = Date.now();
      const timeout = customTimeout || (rememberMe ? this.sessionTimeout : SESSION_TIMEOUTS.SHORT);
      const autoLogoutTime = currentTime + timeout;

      const userDataToStore = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
        sessionId: sessionId,
        loginTime: currentTime,
      };

      // Save all session data in parallel
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.IS_AUTHENTICATED, 'true'),
        AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userDataToStore)),
        AsyncStorage.setItem(STORAGE_KEYS.LAST_LOGIN_TIME, currentTime.toString()),
        AsyncStorage.setItem(STORAGE_KEYS.REMEMBER_ME, rememberMe.toString()),
        AsyncStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId),
        AsyncStorage.setItem(STORAGE_KEYS.AUTO_LOGOUT_TIME, autoLogoutTime.toString()),
      ]);

      // Save token if available
      if (user.accessToken) {
        await AsyncStorage.setItem(STORAGE_KEYS.USER_TOKEN, user.accessToken);
      }

      this.sessionId = sessionId;
      
      console.log('Session saved successfully:', {
        sessionId,
        rememberMe,
        timeout: timeout / (1000 * 60 * 60), // hours
        autoLogoutTime: new Date(autoLogoutTime).toISOString(),
      });

      return { success: true, sessionId };
    } catch (error) {
      console.error('Error saving session:', error);
      return { success: false, error: error.message };
    }
  }

  // Load session data
  async loadSession() {
    try {
      const [
        isAuthenticated,
        userData,
        userToken,
        lastLoginTime,
        rememberMe,
        sessionId,
        autoLogoutTime
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.IS_AUTHENTICATED),
        AsyncStorage.getItem(STORAGE_KEYS.USER_DATA),
        AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_LOGIN_TIME),
        AsyncStorage.getItem(STORAGE_KEYS.REMEMBER_ME),
        AsyncStorage.getItem(STORAGE_KEYS.SESSION_ID),
        AsyncStorage.getItem(STORAGE_KEYS.AUTO_LOGOUT_TIME),
      ]);

      if (!isAuthenticated || isAuthenticated !== 'true' || !userData) {
        return { success: false, reason: 'No session found' };
      }

      const currentTime = Date.now();
      const parsedUserData = JSON.parse(userData);

      // Check if session has expired
      if (autoLogoutTime && currentTime > parseInt(autoLogoutTime)) {
        console.log('Session expired, clearing data');
        await this.clearSession();
        return { success: false, reason: 'Session expired' };
      }

      // Add token to user data if available
      if (userToken) {
        parsedUserData.accessToken = userToken;
      }

      // Set session ID
      this.sessionId = sessionId;

      const sessionInfo = {
        user: parsedUserData,
        sessionId,
        lastLoginTime: parseInt(lastLoginTime),
        rememberMe: rememberMe === 'true',
        autoLogoutTime: parseInt(autoLogoutTime),
        timeRemaining: parseInt(autoLogoutTime) - currentTime,
      };

      console.log('Session loaded successfully:', {
        sessionId,
        email: parsedUserData.email,
        timeRemaining: Math.round(sessionInfo.timeRemaining / (1000 * 60 * 60)), // hours
      });

      return { success: true, sessionInfo };
    } catch (error) {
      console.error('Error loading session:', error);
      await this.clearSession(); // Clear potentially corrupted data
      return { success: false, error: error.message };
    }
  }

  // Check if session is valid
  async isSessionValid() {
    try {
      const [autoLogoutTime, sessionId] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.AUTO_LOGOUT_TIME),
        AsyncStorage.getItem(STORAGE_KEYS.SESSION_ID),
      ]);

      if (!autoLogoutTime || !sessionId) {
        return false;
      }

      const currentTime = Date.now();
      const isValid = currentTime < parseInt(autoLogoutTime);

      if (!isValid) {
        console.log('Session validation failed: expired');
        await this.clearSession();
      }

      return isValid;
    } catch (error) {
      console.error('Error checking session validity:', error);
      return false;
    }
  }

  // Refresh session (extend expiry time)
  async refreshSession(extendBy = null) {
    try {
      const [rememberMe, currentAutoLogoutTime] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.REMEMBER_ME),
        AsyncStorage.getItem(STORAGE_KEYS.AUTO_LOGOUT_TIME),
      ]);

      if (!currentAutoLogoutTime) {
        return { success: false, reason: 'No active session' };
      }

      const currentTime = Date.now();
      const extension = extendBy || (rememberMe === 'true' ? this.sessionTimeout : SESSION_TIMEOUTS.SHORT);
      const newAutoLogoutTime = currentTime + extension;

      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.LAST_LOGIN_TIME, currentTime.toString()),
        AsyncStorage.setItem(STORAGE_KEYS.AUTO_LOGOUT_TIME, newAutoLogoutTime.toString()),
      ]);

      console.log('Session refreshed:', {
        sessionId: this.sessionId,
        newExpiry: new Date(newAutoLogoutTime).toISOString(),
        extensionHours: extension / (1000 * 60 * 60),
      });

      return { success: true, newAutoLogoutTime };
    } catch (error) {
      console.error('Error refreshing session:', error);
      return { success: false, error: error.message };
    }
  }

  // Clear session data
  async clearSession() {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.IS_AUTHENTICATED,
        STORAGE_KEYS.USER_DATA,
        STORAGE_KEYS.USER_TOKEN,
        STORAGE_KEYS.LAST_LOGIN_TIME,
        STORAGE_KEYS.REMEMBER_ME,
        STORAGE_KEYS.SESSION_ID,
        STORAGE_KEYS.AUTO_LOGOUT_TIME,
      ]);

      this.sessionId = null;
      console.log('Session cleared successfully');
      return { success: true };
    } catch (error) {
      console.error('Error clearing session:', error);
      return { success: false, error: error.message };
    }
  }

  // Get session info
  async getSessionInfo() {
    try {
      const [sessionId, autoLogoutTime, lastLoginTime, rememberMe] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SESSION_ID),
        AsyncStorage.getItem(STORAGE_KEYS.AUTO_LOGOUT_TIME),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_LOGIN_TIME),
        AsyncStorage.getItem(STORAGE_KEYS.REMEMBER_ME),
      ]);

      if (!sessionId || !autoLogoutTime) {
        return null;
      }

      const currentTime = Date.now();
      const timeRemaining = parseInt(autoLogoutTime) - currentTime;

      return {
        sessionId,
        lastLoginTime: parseInt(lastLoginTime),
        autoLogoutTime: parseInt(autoLogoutTime),
        timeRemaining,
        rememberMe: rememberMe === 'true',
        isExpired: timeRemaining <= 0,
        daysRemaining: Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60 * 24))),
        hoursRemaining: Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60))),
      };
    } catch (error) {
      console.error('Error getting session info:', error);
      return null;
    }
  }

  // Set custom session timeout
  setSessionTimeout(timeout) {
    this.sessionTimeout = timeout;
  }

  // Get available timeout options
  getTimeoutOptions() {
    return {
      SHORT: SESSION_TIMEOUTS.SHORT,
      MEDIUM: SESSION_TIMEOUTS.MEDIUM,
      LONG: SESSION_TIMEOUTS.LONG,
      EXTENDED: SESSION_TIMEOUTS.EXTENDED,
    };
  }

  // Convert milliseconds to human readable format
  formatTimeRemaining(milliseconds) {
    if (milliseconds <= 0) return 'Expired';

    const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
    const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
  }
}

// Export singleton instance
export default new SessionManager();
