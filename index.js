import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import messaging from '@react-native-firebase/messaging';
import { navigate } from './navigation/RootNavigation';
import { addNotificationFromRemote } from './services/notificationStore';

import App from './App';

// Minimal background handler; tap on notification navigates via App.js handlers
messaging().setBackgroundMessageHandler(async remoteMessage => {
  if (remoteMessage) await addNotificationFromRemote(remoteMessage);
});

registerRootComponent(App);
