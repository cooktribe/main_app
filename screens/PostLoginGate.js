import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { COLORS } from '../constants/Colors';
import { consumeNotificationsPending } from '../services/pendingNav';
import { navigate } from '../navigation/RootNavigation';

export default function PostLoginGate({ navigation }) {
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkProfile = async () => {
      try {
        if (!user?.uid) {
          navigation.replace('MainTabs');
          return;
        }
        const snap = await getDoc(doc(db, 'users', user.uid));
        const profileCompleted = snap.exists() ? !!snap.data()?.profileCompleted : false;
        if (!profileCompleted) {
          navigation.replace('ProfileEdit');
        } else {
          navigation.replace('MainTabs');
          setTimeout(async () => {
            const shouldGo = await consumeNotificationsPending();
            if (shouldGo) navigate('Notifications');
          }, 0);
        }
      } catch (e) {
        navigation.replace('MainTabs');
        setTimeout(async () => {
          const shouldGo = await consumeNotificationsPending();
          if (shouldGo) navigate('Notifications');
        }, 0);
      } finally {
        setChecking(false);
      }
    };
    checkProfile();
  }, [user?.uid]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}


