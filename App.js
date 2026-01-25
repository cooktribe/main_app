import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import AppNavigator from './navigation/AppNavigator';
import CustomSplashScreen from './components/SplashScreen';
import { AuthProvider } from './context/AuthContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import { ChatProvider } from './context/ChatContext';
import messaging from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { saveFcmToken } from './services/fcmTokenService';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { safeNavigate } from './navigation/RootNavigation';
import { setNotificationsPending } from './services/pendingNav';
import { addNotificationFromRemote } from './services/notificationStore';

// Prevent the splash screen from auto-hiding before asset loading is complete
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Prepare app and hide splash screen after app is ready
    const prepareApp = async () => {
      try {
        // Simulate loading time (you can add your actual loading logic here)
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Hide native splash screen
        await SplashScreen.hideAsync();
        
        // Show app content
        setIsReady(true);
      } catch (error) {
        console.warn('Error preparing app:', error);
        setIsReady(true);
      }
    };

    prepareApp();
  }, []);

  useEffect(() => {
    const requestNotificationPermission = async () => {
      try {
        if (Platform.OS === 'android' && Platform.Version >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            return;
          }
        }

        await messaging().registerDeviceForRemoteMessages();
        await messaging().getToken();
      } catch (err) {
        // Silently ignore token errors in production UI
      }
    };

    requestNotificationPermission();
    return () => {};
  }, []);

  // Receive messages while app is in foreground
  useEffect(() => {
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      try {
        if (remoteMessage) {
          await addNotificationFromRemote(remoteMessage);
          const title = remoteMessage?.notification?.title || 'Notification';
          const body = remoteMessage?.notification?.body || '';
          if (title || body) {
            Alert.alert(title, body);
          }
        }
      } catch {}
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Save token whenever auth state changes (only for logged-in users)
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async currentUser => {
      if (!currentUser?.uid) return;
      try {
        await messaging().registerDeviceForRemoteMessages();
        const token = await messaging().getToken();
        await saveFcmToken({ userId: currentUser.uid, token, platform: Platform.OS });
      } catch {}
    });

    const unsubscribeRefresh = messaging().onTokenRefresh(async newToken => {
      const currentUser = auth.currentUser;
      if (!currentUser?.uid) return;
      try {
        await saveFcmToken({ userId: currentUser.uid, token: newToken, platform: Platform.OS });
      } catch {}
    });

    return () => {
      unsubscribeAuth();
      unsubscribeRefresh();
    };
  }, []);

  // Navigate to Notifications on tap (foreground/background/quit)
  useEffect(() => {
    const subOpened = messaging().onNotificationOpenedApp(remoteMessage => {
      if (remoteMessage) addNotificationFromRemote(remoteMessage);
      safeNavigate('Notifications');
    });
    messaging().getInitialNotification().then(remoteMessage => {
      if (remoteMessage) {
        addNotificationFromRemote(remoteMessage);
        // Delay actual navigation until gating navigation finishes
        setNotificationsPending();
        safeNavigate('Notifications');
      }
    });
    return () => {
      subOpened();
    };
  }, []);

  if (!isReady) {
    return <CustomSplashScreen />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <SubscriptionProvider>
          <ChatProvider>
            <AppNavigator />
          </ChatProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
